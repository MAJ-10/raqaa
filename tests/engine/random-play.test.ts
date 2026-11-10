// Plays many random competitions through the engine. At every moment the test lists what the referee
// screen offers (the same selectors the screen uses), picks one at random, and checks that the engine
// accepts it. A competition must never get stuck, must keep its rules true, and must reach the end.
import { describe, expect, it } from 'vitest';
import { BANKS } from '../../src/content/index.ts';
import { makeContent, newChallenge, type Random } from '../../src/engine/content.ts';
import { basePlot, getBoard, neighbours } from '../../src/engine/board.ts';
import { announcement, ranking } from '../../src/engine/missions.ts';
import { initialState, reduce, replay } from '../../src/engine/reduce.ts';
import {
  canUseCard,
  currentChallenge,
  nextAuction,
  openAuction,
  options,
  planTargets,
  population,
  questionsLeft,
  wins,
} from '../../src/engine/select.ts';
import { sampleSetup } from '../../src/engine/scenarios.ts';
import { TEAMS, type EventInput, type GameEvent, type GameState, type Setup, type Team } from '../../src/engine/types.ts';

/** A small seeded random generator, so a failing game can be played again. */
function seeded(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const any = <T>(list: readonly T[], random: Random): T => list[Math.floor(random() * list.length)]!;

/** What the referee screen offers now, apart from ending early (picked less often). */
function offered(s: GameState, random: Random): EventInput[] {
  const list: EventInput[] = [];
  const q = s.question;
  switch (s.step) {
    case 'setup':
      list.push({ type: 'game/start' });
      break;
    case 'question': {
      // The referee chooses the kind (group more often, so more teams build), and sometimes changes it.
      if (q.kind === null) {
        list.push({ type: 'question/kind', kind: random() < 0.7 ? 'group' : 'individual' });
        break;
      }
      if (!q.numbers && random() < 0.2) list.push({ type: 'question/kind', kind: q.kind === 'group' ? 'individual' : 'group' });
      if (q.kind === 'individual' && !q.numbers) list.push({ type: 'numbers/show' });
      if (q.kind === 'group' || q.numbers) list.push({ type: q.index !== null ? 'question/show' : 'question/outside' });
      if (q.index !== null && questionsLeft(s) > 0) list.push({ type: 'question/replace' });
      break;
    }
    case 'asking':
      list.push({ type: 'answer/show' });
      if (s.timer) list.push({ type: 'timer/end' }); // a group question; an individual one has no timer
      if (q.index !== null && questionsLeft(s) > 0) list.push({ type: 'question/replace' });
      break;
    case 'answer': {
      const right = TEAMS.filter(() => random() < 0.7);
      list.push({ type: 'permits/set', teams: q.kind === 'individual' ? right.slice(0, 1) : right });
      break;
    }
    case 'build': {
      const pending = s.pending;
      if (pending?.kind === 'fence') {
        list.push({ type: 'card/fence', auction: pending.auction }, { type: 'fence/skip', auction: pending.auction });
      } else if (pending?.kind === 'inspector') {
        // The inspector is used as soon as it is taken: the referee picks whose missions to show.
        for (const target of TEAMS.filter((t) => t !== pending.team)) {
          list.push({ type: 'card/inspector', team: pending.team, target });
        }
      } else if (pending?.kind === 'plan') {
        const board = getBoard(s.setup.size);
        const own = board.ids.filter(
          (id) => s.plots[id]?.owner === pending.team && !board.plots[id]?.base && !s.plots[id]?.plan,
        );
        if (own.length >= 2) {
          // Mostly on plots that touch another team, where bids come, so plans fire in the games.
          const border = own.filter((id) =>
            neighbours(board, id).some((near) => ![null, pending.team].includes(s.plots[near]?.owner ?? null)),
          );
          const from = border.length >= 2 && random() < 0.8 ? border : own;
          const first = any(from, random);
          const second = any(
            from.filter((id) => id !== first),
            random,
          );
          list.push({ type: 'card/plan', team: pending.team, plots: [first, second] });
        }
      } else if (s.turn) {
        const team = s.turn;
        if (s.teams[team].moves > 0) {
          // Every allowed plot, but leaning towards auctions (and plots with a plan) so the games reach them.
          const o = options(s, team);
          const planned = o.auction.filter((id) => s.plots[id]?.plan);
          const auctions = planned.length > 0 && random() < 0.6 ? planned : o.auction;
          if (auctions.length > 0 && random() < 0.6) {
            for (const plot of auctions) list.push({ type: 'auction/declare', team, plot });
            break;
          }
          for (const plot of o.build) list.push({ type: 'build', team, plot });
          for (const plot of o.auction) list.push({ type: 'auction/declare', team, plot });
          for (const plot of o.bridge) list.push({ type: 'build', team, plot, via: 'bridge' });
        } else {
          list.push({ type: 'turn/pass', team });
        }
        if (canUseCard(s, team, 'crane')) list.push({ type: 'card/crane', team });
      }
      break;
    }
    case 'auctions': {
      const pending = s.pending;
      if (pending?.kind === 'planTake') {
        for (const plot of planTargets(s, pending.from, pending.plot)) list.push({ type: 'plan/take', team: pending.team, plot });
        break;
      }
      const open = openAuction(s);
      const next = nextAuction(s);
      if (open) {
        const challenge = currentChallenge(open);
        if (!challenge) {
          list.push({ type: 'challenge/start', auction: open.id, content: newChallenge(s, BANKS, random).content });
        } else if (s.plots[open.plot]?.plan && random() < 0.7) {
          // A bid on a plan plot: lean towards the defender, so plans fire in the games.
          list.push({ type: 'challenge/result', auction: open.id, winner: open.defender });
        } else {
          for (const winner of [open.bidder, open.defender]) list.push({ type: 'challenge/result', auction: open.id, winner });
          list.push({
            type: 'challenge/replay',
            auction: open.id,
            content: makeContent(s, challenge.content.type, BANKS, random).content,
          });
          if (s.timer?.kind === 'challenge' && !challenge.stopped) list.push({ type: 'timer/end' });
        }
      } else if (next) {
        list.push({ type: 'auction/open', auction: next.id });
      }
      break;
    }
    case 'dayEnd':
      if (s.day < s.days) list.push({ type: 'day/end' });
      else list.push(s.days < 24 && random() < 0.3 ? { type: 'days/extend', count: 1 + Math.floor(random() * 3) } : { type: 'game/end' });
      break;
    case 'announce':
      if (s.announce < announcement(s).length - 1) list.push({ type: 'announce/next' });
      break;
  }
  return list;
}

/** Things that must stay true at every moment of a competition. */
function checkRules(s: GameState): void {
  const board = getBoard(s.setup.size);
  for (const team of TEAMS) {
    expect(s.plots[basePlot(s.setup.size, team)]?.owner, `${team} keeps its base`).toBe(team);
    expect(s.teams[team].moves, `${team} moves`).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(population(s, team))).toBe(true);
  }
  for (const id of board.ids) {
    const plot = s.plots[id]!;
    if (plot.plan) expect(plot.owner, `the plan on ${id} belongs to the plot's owner`).toBe(plot.plan);
  }
  if (s.turn) expect(s.order).toContain(s.turn);
  expect(s.auctions.filter((a) => a.status === 'open').length).toBeLessThanOrEqual(1);
  for (const a of s.auctions) {
    if (a.status !== 'done') continue;
    const loser = a.winner === a.bidder ? a.defender : a.bidder;
    expect(wins(a, a.winner!)).toBe(2);
    expect(wins(a, loser)).toBeLessThan(2);
  }
  if (s.timer?.kind === 'question') expect(s.step).toBe('asking');
  if (s.permits.length > 1) expect(s.question.kind).toBe('group');
}

type Result = { state: GameState; events: GameEvent[]; undos: number; planDeadEnds: number };

/** One random competition, from «ابدأ» to the last step of the announcement. */
function playOne(setup: Setup, random: Random): Result {
  const events: GameEvent[] = [];
  const states: GameState[] = [initialState(setup)];
  let undos = 0;
  let planDeadEnds = 0;
  let at = 0;

  for (let guard = 0; guard < 5000; guard++) {
    const s = states.at(-1)!;
    if (s.step === 'announce' && s.announce >= announcement(s).length - 1) return { state: s, events, undos, planDeadEnds };

    // «تراجع» now and then, as the referee might press it.
    if (events.length > 0 && random() < 0.03) {
      events.pop();
      states.pop();
      undos += 1;
      continue;
    }

    let choices = offered(s, random);
    if (s.step === 'dayEnd' && s.day < s.days && random() < 0.02) choices = [{ type: 'game/end' }];

    if (choices.length === 0) {
      // The one known dead end (decision: very rare cases get no extra rule): a plan taken by a team
      // with fewer than two plots to put it on. The referee undoes the build that took it.
      expect(s.pending?.kind, `stuck at step ${s.step}, day ${s.day}`).toBe('plan');
      planDeadEnds += 1;
      events.pop();
      states.pop();
      continue;
    }

    at += 5000;
    const event = { ...any(choices, random), at } as GameEvent;
    const next = reduce(s, event); // throws if the screen offered something the rules refuse
    checkRules(next);
    events.push(event);
    states.push(next);
  }
  throw new Error('The competition never reached the end of the announcement');
}

/** Every event the referee can cause. `timer/restart` comes from reopening the window, not from a button. */
const REFEREE_EVENTS: GameEvent['type'][] = [
  'game/start',
  'question/kind',
  'numbers/show',
  'question/show',
  'question/replace',
  'question/outside',
  'answer/show',
  'timer/end',
  'permits/set',
  'build',
  'auction/declare',
  'card/fence',
  'fence/skip',
  'card/crane',
  'card/plan',
  'card/inspector',
  'turn/pass',
  'auction/open',
  'challenge/start',
  'challenge/result',
  'challenge/replay',
  'plan/take',
  'day/end',
  'days/extend',
  'game/end',
  'announce/next',
];

describe('random competitions', () => {
  it('every offered action is allowed, nothing gets stuck, and every game ends, on both maps', { timeout: 60_000 }, () => {
    let planDeadEnds = 0;
    const seen = new Set<string>();
    // The big map needs longer games for the teams to meet.
    for (const { size, games, days } of [
      { size: 9, games: 100, days: 14 },
      { size: 7, games: 120, days: 6 },
    ] as const) {
      for (let game = 0; game < games; game++) {
        const random = seeded(size * 1000 + game);
        const setup = sampleSetup(size, days + Math.floor(random() * 10));
        const result = playOne(setup, random);
        planDeadEnds += result.planDeadEnds;
        for (const e of result.events) seen.add(e.type === 'build' && e.via ? 'build/bridge' : e.type);

        // The state is the fold of the events: replaying them gives the same competition.
        expect(replay(setup, result.events), `game ${game}`).toEqual(result.state);
        expect(ranking(result.state)).toHaveLength(4);
        expect(TEAMS.every((team: Team) => ranking(result.state).some((r) => r.team === team))).toBe(true);
      }
    }
    // The games went down every path: each event, and a bridge, happened at least once.
    expect([...REFEREE_EVENTS, 'build/bridge'].filter((type) => !seen.has(type))).toEqual([]);
    expect(planDeadEnds, 'plans with nowhere to go').toBeLessThan(10);
  });
});
