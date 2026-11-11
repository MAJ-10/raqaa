// Plays many random competitions through the engine. At every moment the test lists what the referee
// screen offers (the same selectors the screen uses), picks one at random, and checks that the engine
// accepts it. A competition must never get stuck, must keep its rules true, and must reach the end.
import { describe, expect, it } from 'vitest';
import { BANKS } from '../../src/content/index.ts';
import { any, offered, seeded } from '../../src/engine/autoplay.ts';
import type { Random } from '../../src/engine/content.ts';
import { basePlot, getBoard } from '../../src/engine/board.ts';
import { announcement, ranking } from '../../src/engine/missions.ts';
import { initialState, reduce, replay } from '../../src/engine/reduce.ts';
import { population, wins } from '../../src/engine/select.ts';
import { sampleSetup } from '../../src/engine/scenarios.ts';
import { TEAMS, type GameEvent, type GameState, type Setup, type Team } from '../../src/engine/types.ts';

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

    let choices = offered(s, random, BANKS);
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
