// Ready-made competitions stopped at interesting moments. Tests use them, and so can the screens later.
import { initialState, reduce } from './reduce.ts';
import type { GameEvent, GameState, PlotId, Setup, Team } from './types.ts';

type WithoutTime<E> = E extends unknown ? Omit<E, 'at'> : never;
export type EventInput = WithoutTime<GameEvent>;

/** One move in a team's turn: a plot id builds there. */
export type Move =
  | PlotId
  | { build: PlotId; bridge?: boolean; plan?: [PlotId, PlotId] }
  | { auction: PlotId; fence?: boolean }
  | 'crane';

/** Plays events one at a time, checking each against the rules. Times go up 5 seconds per event. */
export class Play {
  state: GameState;
  readonly events: GameEvent[] = [];
  private clock = Date.UTC(2026, 10, 1, 16, 0, 0);

  constructor(setup: Setup) {
    this.state = initialState(setup);
  }

  do(event: EventInput): this {
    this.clock += 5000;
    const timed = { ...event, at: this.clock } as GameEvent;
    this.state = reduce(this.state, timed);
    this.events.push(timed);
    return this;
  }

  /** The day's question, through to the permits. */
  question(permits: Team[]): this {
    if (this.state.question.kind === 'individual') this.do({ type: 'numbers/show' });
    return this.do({ type: 'question/show' }).do({ type: 'answer/show' }).do({ type: 'permits/set', teams: permits });
  }

  /**
   * Plays the build step in turn order. Each team's list gives its moves in order. A team that is out
   * of moves while it could still use a crane passes, unless its list asks for the crane.
   */
  build(moves: Partial<Record<Team, Move[]>>): this {
    const queues: Partial<Record<Team, Move[]>> = Object.fromEntries(
      Object.entries(moves).map(([team, list]) => [team, [...list]]),
    );
    while (this.state.step === 'build' && this.state.turn) {
      const team = this.state.turn;
      const move = queues[team]?.shift();
      if (move === undefined) {
        if (this.state.teams[team].moves > 0) throw new Error(`No move given for ${team}`);
        this.do({ type: 'turn/pass', team });
        continue;
      }
      if (move === 'crane') {
        this.do({ type: 'card/crane', team });
      } else if (typeof move === 'string' || 'build' in move) {
        const m = typeof move === 'string' ? { build: move } : move;
        this.do(m.bridge ? { type: 'build', team, plot: m.build, via: 'bridge' } : { type: 'build', team, plot: m.build });
        if (this.state.pending?.kind === 'plan') {
          if (!('plan' in m) || !m.plan) throw new Error(`${team} took a plan: say where it goes`);
          this.do({ type: 'card/plan', team, plots: m.plan });
        }
      } else {
        this.do({ type: 'auction/declare', team, plot: move.auction });
        const pending = this.state.pending;
        if (pending?.kind === 'fence') {
          this.do({ type: move.fence ? 'card/fence' : 'fence/skip', auction: pending.auction });
        }
      }
    }
    const left = Object.entries(queues).filter(([, list]) => list && list.length > 0);
    if (left.length > 0) throw new Error(`Moves not played: ${JSON.stringify(left)}`);
    return this;
  }

  /** Opens the next auction and plays challenges with these winners. "tie" replays the challenge. */
  auction(winners: (Team | 'tie')[], planTake?: PlotId): this {
    const auction = this.state.auctions.find((a) => a.day === this.state.day && a.status === 'declared');
    if (!auction) throw new Error('No auction to open');
    this.do({ type: 'auction/open', auction: auction.id });
    let running = false;
    for (const winner of winners) {
      if (!running) this.do({ type: 'challenge/start', auction: auction.id, content: { type: 'precision' } });
      if (winner === 'tie') {
        this.do({ type: 'challenge/replay', auction: auction.id, content: { type: 'precision' } });
        running = true;
      } else {
        this.do({ type: 'challenge/result', auction: auction.id, winner });
        running = false;
      }
    }
    if (this.state.pending?.kind === 'planTake') {
      if (!planTake) throw new Error('The plan fired: say which plot it takes');
      this.do({ type: 'plan/take', team: this.state.pending.team, plot: planTake });
    }
    return this;
  }

  endDay(): this {
    return this.do({ type: 'day/end' });
  }
}

export type Scenario = { setup: Setup; events: GameEvent[]; state: GameState };

const done = (play: Play): Scenario => ({ setup: play.state.setup, events: play.events, state: play.state });

/** A sample setup. Team names are only sample data; real names come from the referee's setup. */
export function sampleSetup(size: Setup['size'] = 9, days = 8): Setup {
  return {
    size,
    days,
    teams: {
      coral: { name: 'الرواد', players: 3, missions: ['tower', 'collector'] },
      blue: { name: 'النجوم', players: 4, missions: ['successfulBidder'] },
      green: { name: 'الصقور', players: 2, missions: ['block', 'everyRing', 'heart'] },
      gold: { name: 'الفرسان', players: 3, missions: ['neighbourOfAll'] },
    },
    questions: [
      { text: 'كم عدد أيام الأسبوع؟', answer: '٧' },
      { text: 'ما عاصمة المملكة العربية السعودية؟', answer: 'الرياض' },
      { text: 'كم ضلعاً للمثلث؟', answer: '٣' },
      { text: 'ما الكوكب الأقرب إلى الشمس؟', answer: 'عطارد' },
      { text: 'كم دقيقة في الساعة؟', answer: '٦٠' },
      { text: 'ما أكبر محيط في العالم؟', answer: 'الهادي' },
      { text: 'كم عدد قارات العالم؟', answer: '٧' },
      { text: 'ما لون الزمرد؟', answer: 'أخضر' },
      { text: 'كم شهراً في السنة؟', answer: '١٢' },
      { text: 'ما الحيوان الملقب بسفينة الصحراء؟', answer: 'الجمل' },
      { text: 'كم عدد حروف اللغة العربية؟', answer: '٢٨' },
      { text: 'ما أطول نهر في العالم؟', answer: 'النيل' },
    ],
  };
}

/** Four days on the 9×9 map: coral and blue meet along the top row. */
function fourDays(setup: Setup): Play {
  const all: Team[] = ['coral', 'blue', 'green', 'gold'];
  return new Play(setup)
    .do({ type: 'game/start' })
    .question(all)
    .build({ coral: ['1-2'], blue: ['1-8'], green: ['9-2'], gold: ['9-8'] })
    .endDay()
    .question(all)
    .build({ coral: ['1-3'], blue: ['1-7'], green: ['9-3'], gold: ['9-7'] })
    .endDay()
    .question(all)
    .build({ coral: ['1-4'], blue: ['1-6'], green: ['9-4'], gold: ['9-6'] })
    .endDay()
    .question(all)
    .build({ coral: ['1-5'], blue: ['2-7'], green: ['8-4'], gold: ['8-6'] })
    .endDay();
}

/** Day 5: coral bids for blue's plot 1-6; the auction is open and coral won the first challenge. */
export function openAuctionScenario(): Scenario {
  const play = fourDays(sampleSetup(9, 8)).question(['coral', 'blue']).build({ coral: [{ auction: '1-6' }], blue: ['2-6'] });
  const auction = play.state.auctions.find((a) => a.status === 'declared')!;
  play
    .do({ type: 'auction/open', auction: auction.id })
    .do({ type: 'challenge/start', auction: auction.id, content: { type: 'precision' } })
    .do({ type: 'challenge/result', auction: auction.id, winner: 'coral' })
    .do({ type: 'challenge/start', auction: auction.id, content: { type: 'building' } });
  return done(play);
}

/**
 * 7×7 map, day 6: coral placed its plan on 2-4 and 3-4. Blue bid for 2-4 and lost, so the plan fired:
 * coral now picks a plot of blue's next to 2-4.
 */
export function planScenario(): Scenario {
  const two: Team[] = ['coral', 'blue'];
  const play = new Play(sampleSetup(7, 8))
    .do({ type: 'game/start' })
    .question(two)
    .build({ coral: ['1-2'], blue: ['1-6'] })
    .endDay()
    .question(two)
    .build({ coral: ['1-3'], blue: ['1-5'] })
    .endDay()
    .question(two)
    .build({ coral: ['1-4'], blue: ['2-5'] }) // blue takes the fence on 2-5
    .endDay()
    .question(two)
    .build({ coral: ['2-4'], blue: ['3-5'] }) // coral takes the bridge on 2-4
    .endDay()
    .question(two)
    .build({ coral: [{ build: '3-4', plan: ['2-4', '3-4'] }], blue: ['3-6'] }) // coral takes a plan
    .endDay()
    .question(two)
    .build({ coral: ['4-4'], blue: [{ auction: '2-4' }] });
  const auction = play.state.auctions.find((a) => a.status === 'declared')!;
  play
    .do({ type: 'auction/open', auction: auction.id })
    .do({ type: 'challenge/start', auction: auction.id, content: { type: 'precision' } })
    .do({ type: 'challenge/result', auction: auction.id, winner: 'coral' })
    .do({ type: 'challenge/start', auction: auction.id, content: { type: 'building' } })
    .do({ type: 'challenge/result', auction: auction.id, winner: 'coral' });
  return done(play);
}

/** The end of the last day (day 5 of 5): the referee chooses to extend or announce. Population is hidden. */
export function lastDayScenario(): Scenario {
  const play = fourDays(sampleSetup(9, 5))
    .question(['coral', 'blue', 'gold'])
    .build({ coral: [{ auction: '1-6' }], blue: ['2-6'], gold: ['8-7'] })
    .auction(['coral', 'blue', 'tie', 'coral']);
  return done(play);
}
