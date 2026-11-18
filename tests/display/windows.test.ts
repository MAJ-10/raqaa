// Phase 5: what the display shows over the game at each moment, from the state and the last event.
import { describe, expect, it } from 'vitest';
import { boardLooks, landing } from '../../src/display/board-art.ts';
import { announcedPopulation, CARD_TIME, displayWindow, JUMP, LAND, MOMENT, nextWake, PERMITS_TIME, signLook, type DisplayWindow } from '../../src/display/windows.ts';
import { plotNumbers } from '../../src/ui/plot-numbers.ts';
import { announcement } from '../../src/engine/missions.ts';
import { fourDays, fourSmallDays, lastDayScenario, Play, planScenario, sampleSetup, SUM } from '../../src/engine/scenarios.ts';
import { buildOrder, nextAuction, options, population } from '../../src/engine/select.ts';
import { COUNTDOWN, QUESTION_SECONDS } from '../../src/engine/timing.ts';
import { TEAMS, type ChallengeContent } from '../../src/engine/types.ts';
import { give } from '../engine/helpers.ts';

/** What the display shows right after the last event, or `later` ms after it. */
function shownNow(play: Play, later = 100): DisplayWindow | null {
  const last = play.events.at(-1) ?? null;
  return displayWindow(play.state, last, (last?.at ?? 0) + later);
}

/** Day 5: coral declares an auction on blue's 1-6, and the referee opens it. */
function openAuction(): { play: Play; id: number } {
  const play = fourDays().question(['coral', 'blue']).build({ coral: [{ auction: '1-6' }], blue: ['2-6'] });
  const id = nextAuction(play.state)!.id;
  play.do({ type: 'auction/open', auction: id });
  return { play, id };
}

describe('the day’s question on the display', () => {
  it('shows nothing before the numbers, then each team’s player number in an individual question', () => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' }).do({ type: 'question/kind', kind: 'individual' });
    expect(shownNow(play)).toBeNull();
    play.do({ type: 'numbers/show' });
    const shown = shownNow(play);
    expect(shown?.kind).toBe('numbers');
    expect(shown?.kind === 'numbers' && shown.numbers).toEqual(play.state.question.numbers);
  });

  it('shows the question with no timer in an individual question; the boards keep each team’s number', () => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' }).do({ type: 'question/kind', kind: 'individual' });
    play.do({ type: 'numbers/show' }).do({ type: 'question/show' });
    const shown = shownNow(play);
    expect(shown).toMatchObject({ kind: 'question', text: 'كم عدد أيام الأسبوع؟', timer: null });
    for (const team of TEAMS) {
      expect(signLook(play.state, team, shown)).toEqual({
        faded: false,
        filled: true,
        permit: false,
        board: { number: play.state.question.numbers![team] },
      });
    }
  });

  it('counts down to the question, then runs a 20-second timer on a group question; it never says individual or group', () => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' }).do({ type: 'question/kind', kind: 'group' }).do({ type: 'question/show' });
    const shown = shownNow(play);
    const showsAt = play.events.at(-1)!.at + COUNTDOWN * 1000;
    expect(shown).toEqual({
      kind: 'question',
      text: 'كم عدد أيام الأسبوع؟',
      showsAt,
      timer: { startedAt: showsAt, seconds: QUESTION_SECONDS },
    });
    expect(signLook(play.state, 'coral', shown).board).toEqual({ population: 100 });
  });

  it('shows the answer with the teams in build order, then marks them once the permits are confirmed', () => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' });
    play.do({ type: 'question/kind', kind: 'group' }).do({ type: 'question/show' }).do({ type: 'answer/show' });
    // The question stays over its answer: one card.
    expect(shownNow(play)).toEqual({ kind: 'answer', text: 'كم عدد أيام الأسبوع؟', answer: '٧', teams: buildOrder(play.state), permits: null, individual: false });

    play.do({ type: 'permits/set', teams: ['blue', 'gold'] });
    expect(shownNow(play)).toMatchObject({ kind: 'answer', permits: ['blue', 'gold'], individual: false });
    // Every board fades behind it.
    expect(TEAMS.every((team) => signLook(play.state, team, shownNow(play)).faded)).toBe(true);
  });

  it('shows the permits a moment, then the map for the team in turn; its first move ends them sooner', () => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' }).question(['coral', 'blue']);
    expect(PERMITS_TIME).toBeLessThanOrEqual(2000);
    expect(shownNow(play, PERMITS_TIME - 100)?.kind).toBe('answer');
    expect(shownNow(play, PERMITS_TIME + 1)).toBeNull();
    // The team in turn fills with its colour; there is no arrow.
    expect(signLook(play.state, 'coral', null)).toMatchObject({ faded: false, filled: true });
    expect(signLook(play.state, 'blue', null).filled).toBe(false);
    play.do({ type: 'build', team: 'coral', plot: '1-2' });
    expect(shownNow(play)).toBeNull();
  });

  it('ticks the board of each team with a permit to use, once the permits have shown, until it has used it', () => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' }).question(['coral', 'blue']);
    expect(signLook(play.state, 'coral', shownNow(play)).permit).toBe(false); // the permits' window shows them
    const ticked = () => TEAMS.filter((team) => signLook(play.state, team, null).permit);
    expect(ticked()).toEqual(['coral', 'blue']);
    play.do({ type: 'build', team: 'coral', plot: '1-2' });
    expect(ticked()).toEqual(['blue']);
  });

  it('says in an individual question that only one team took the permit', () => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' }).question(['green']);
    expect(shownNow(play)).toMatchObject({ kind: 'answer', permits: ['green'], individual: true });
  });
});

describe('cards on the display', () => {
  it('shows a card taken by a build for a moment, then lets the game show again', () => {
    // Coral builds 1-2, 2-2, then 2-3: the fence lies on 2-3.
    let play = new Play(sampleSetup()).do({ type: 'game/start' });
    play = play.question(['coral']).build({ coral: ['1-2'] }).endDay().question(['coral']).build({ coral: ['2-2'] }).endDay();
    play.question(['coral']).do({ type: 'build', team: 'coral', plot: '2-3' });
    // The building lands first; then the card, for its moment.
    expect(shownNow(play)).toBeNull();
    expect(shownNow(play, LAND + 100)).toMatchObject({ kind: 'card', card: 'fence', team: 'coral', says: 'كسب السياج', also: null, taken: true });
    expect(signLook(play.state, 'coral', shownNow(play, LAND + 100))).toMatchObject({ faded: false, filled: true });
    expect(signLook(play.state, 'blue', shownNow(play, LAND + 100))).toMatchObject({ faded: true, filled: false });
    expect(shownNow(play, LAND + CARD_TIME + 1)).toBeNull();
  });

  it('shows the fence with both sides of the cancelled auction', () => {
    const play = fourDays().question(['coral', 'blue']).build({ coral: [{ auction: '1-6', fence: true }], blue: ['2-6'] });
    // The fence was used; blue then built, so look right after the fence.
    const fence = play.events.findIndex((e) => e.type === 'card/fence');
    const at = play.events[fence]!;
    const shown = displayWindow(play.state, at, at.at + 100);
    expect(shown).toMatchObject({ kind: 'card', card: 'fence', team: 'blue', says: 'صدّ المزاد بالسياج', also: 'coral' });
    expect(signLook(play.state, 'coral', shown).faded).toBe(false);
    expect(signLook(play.state, 'green', shown).faded).toBe(true);
  });

  it('keeps a plan secret when it is placed, and shows it on its plot once it strikes', () => {
    const { state, events } = planScenario();
    const placed = events.find((e) => e.type === 'card/plan')!;
    expect(displayWindow(state, placed, placed.at + 100)).toBeNull();
    // Blue lost the auction on 2-4: coral's plan struck there, and the map shows it on the roof.
    expect(boardLooks(state, false).find((look) => look.id === '2-4')).toMatchObject({ symbol: 'coral', plan: true });
    expect(boardLooks(state, false).find((look) => look.id === '3-4')?.plan).toBeUndefined();
  });

  it('shows the plan when it takes a plot', () => {
    const play = new Play(planScenario().setup);
    for (const e of planScenario().events) play.do(e);
    play.do({ type: 'plan/take', team: 'coral', plot: '2-5' });
    expect(shownNow(play)).toMatchObject({ kind: 'card', card: 'plan', team: 'coral', says: 'أخذ قطعة بالمخطط السري', also: null });
  });
});

describe('the auction on the display', () => {
  const math: ChallengeContent = { type: 'math', start: 12, steps: [{ op: '+', n: 8 }, { op: '/', n: 4 }, { op: '*', n: 3 }], answer: 15 };

  it('shows the two sides as soon as it opens, then the challenge picked, then the challenge once it starts', () => {
    const { play, id } = openAuction();
    expect(shownNow(play)).toMatchObject({ kind: 'auction', challenge: null, auction: { picked: null } });
    play.do({ type: 'challenge/pick', auction: id, challenge: 'math' });
    expect(shownNow(play)).toMatchObject({ kind: 'auction', challenge: null, auction: { picked: 'math' } });
    play.do({ type: 'challenge/start', auction: id, content: math });
    expect(shownNow(play)).toMatchObject({
      kind: 'auction',
      challenge: { content: math, startedAt: play.events.at(-1)!.at + COUNTDOWN * 1000, stopped: false, winner: null },
    });
  });

  it('keeps the last challenge, with its winner, until the referee picks the next one', () => {
    const { play, id } = openAuction();
    play.do({ type: 'challenge/start', auction: id, content: math }).do({ type: 'timer/end' });
    expect(shownNow(play)).toMatchObject({ challenge: { stopped: true, winner: null } });
    play.do({ type: 'challenge/result', auction: id, winner: 'blue' });
    expect(shownNow(play, 60_000)).toMatchObject({ kind: 'auction', challenge: { content: math, winner: 'blue' } });
    play.do({ type: 'challenge/pick', auction: id, challenge: 'ordering' });
    expect(shownNow(play)).toMatchObject({ kind: 'auction', challenge: null, auction: { picked: 'ordering' } });
  });

  it('shows the won auction for a moment, then the map', () => {
    const { play, id } = openAuction();
    for (const _ of [0, 1]) {
      play.do({ type: 'challenge/start', auction: id, content: SUM });
      play.do({ type: 'challenge/result', auction: id, winner: 'coral' });
    }
    expect(shownNow(play)).toMatchObject({ kind: 'auction', auction: { status: 'done', winner: 'coral' } });
    expect(shownNow(play, MOMENT + 1)).toBeNull();
    // The display's clock moves on only when something is due: it may still read a time before the result.
    expect(shownNow(play, -2000)).toMatchObject({ kind: 'auction', auction: { status: 'done' } });
  });
});

describe('the announcement on the display', () => {
  /** The last day ended: the referee goes to the announcement. */
  function announce(): Play {
    const { setup, events } = lastDayScenario();
    const play = new Play(setup);
    for (const e of events) play.do(e);
    return play.do({ type: 'game/end' });
  }

  it('shows every population again, the last days included, and adds each mission as it is revealed', () => {
    const play = announce();
    expect(shownNow(play)).toBeNull();
    for (const team of TEAMS) {
      expect(signLook(play.state, team, null)).toEqual({ faded: false, filled: true, permit: false, board: { population: population(play.state, team) } });
    }
    play.do({ type: 'announce/next' });
    const step = announcement(play.state)[1]!;
    if (step.kind !== 'mission') throw new Error('The second step is a mission');
    const shown = shownNow(play);
    expect(shown).toEqual({ kind: 'mission', team: step.team, result: step.result });
    expect(announcedPopulation(play.state, step.team)).toBe(population(play.state, step.team) + step.result.points * 100);
    expect(signLook(play.state, step.team, shown).faded).toBe(false);
    expect(TEAMS.filter((team) => team !== step.team).every((team) => signLook(play.state, team, shown).faded)).toBe(true);
  });
});

describe('the boards in the last days', () => {
  it('show the cards only, without the population', () => {
    let play = new Play(sampleSetup(9, 4)).do({ type: 'game/start' });
    for (let day = 0; day < 2; day++) play = play.question([]).endDay();
    expect(signLook(play.state, 'coral', null).board).toBeNull();
  });
});

describe('the plots the team in turn can act on', () => {
  it('carry the numbers its leader calls out, from the back of the display’s map to the front, right to left', () => {
    // Coral's base is 1-1: 1-2 stands further back on the display than 2-1.
    const coral = new Play(sampleSetup()).do({ type: 'game/start' }).question(['coral']);
    expect([...plotNumbers(coral.state)]).toEqual([
      ['1-2', 1],
      ['2-1', 2],
    ]);
    // Blue's base is 1-9, at the back: its two plots stand side by side, 1-8 on the right.
    const blue = new Play(sampleSetup()).do({ type: 'game/start' }).question(['blue']);
    expect([...plotNumbers(blue.state)]).toEqual([
      ['1-8', 1],
      ['2-9', 2],
    ]);
    // The map shows them on the plots that rise for the team.
    expect(boardLooks(coral.state, false).filter((look) => look.number).map((look) => [look.id, look.number])).toEqual([
      ['1-2', 1],
      ['2-1', 2],
    ]);
  });

  it('numbers none for a team out of moves, until the referee uses its crane', () => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' });
    play.state = give(play.state, 'blue', ['crane']);
    play.question([]); // no permits: blue still has its turn, for its crane
    expect(play.state.turn).toBe('blue');
    expect(plotNumbers(play.state).size).toBe(0);
    expect(boardLooks(play.state, false).some((look) => look.number)).toBe(false);
    play.do({ type: 'card/crane', team: 'blue' });
    expect(plotNumbers(play.state).size).toBeGreaterThan(0);
  });

  it('numbers the plots it can bid for too, in the same count; they stay up, edged as choices', () => {
    // Day 5: coral's 1-5 touches blue's 1-6, built on day 3, so coral can bid for it.
    const play = fourDays().question(['coral']);
    const numbers = plotNumbers(play.state);
    expect(numbers.get('1-6')).toBeGreaterThan(0);
    const looks = boardLooks(play.state, false);
    expect(looks.find((look) => look.id === '1-6')).toMatchObject({ symbol: 'blue', open: 'coral', number: numbers.get('1-6') });
    expect(looks.find((look) => look.id === '1-6')?.faded).toBeUndefined();
    // Blue's other buildings sink while coral plays.
    expect(looks.find((look) => look.id === '1-7')).toMatchObject({ symbol: 'blue', faded: true });
  });

  it('lets the bridge’s line jump before its card shows, from the team’s plot to the one it reached', () => {
    // 7×7, day 5: coral holds the bridge it took on 2-4, and uses it.
    const play = fourSmallDays().question(['coral']);
    const target = options(play.state, 'coral').bridge[0]!;
    expect(plotNumbers(play.state).has(target)).toBe(true);
    play.do({ type: 'build', team: 'coral', plot: target, via: 'bridge' });
    const at = play.events.at(-1)!.at;
    const jump = landing(play.state, play.events.at(-1)!);
    expect(jump).toMatchObject({ plot: target, team: 'coral' });
    expect(play.state.plots[jump!.from!]?.owner).toBe('coral');
    // While the line jumps, the map shows; then the bridge's card, for its moment.
    expect(displayWindow(play.state, play.events.at(-1)!, at + 100)).toBeNull();
    expect(displayWindow(play.state, play.events.at(-1)!, at + JUMP + 100)).toMatchObject({ kind: 'card', card: 'bridge' });
    expect(displayWindow(play.state, play.events.at(-1)!, at + JUMP + CARD_TIME + 1)).toBeNull();
    expect(nextWake(play.events.at(-1)!, at + 100)).toBe(at + JUMP);
    expect(nextWake(play.events.at(-1)!, at + JUMP + 100)).toBe(at + JUMP + CARD_TIME);
  });

  it('has none while no team is building', () => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' }).do({ type: 'question/kind', kind: 'group' });
    expect(plotNumbers(play.state).size).toBe(0);
  });
});
