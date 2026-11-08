// Criterion 15: the result, the tie rules (decision) and extending. Also the last days and the announcement.
import { describe, expect, it } from 'vitest';
import { announcement, ranking } from '../../src/engine/missions.ts';
import { RuleError } from '../../src/engine/reduce.ts';
import { lastDayScenario, Play, sampleSetup } from '../../src/engine/scenarios.ts';
import { isMapFull, populationHidden } from '../../src/engine/select.ts';
import type { GameState } from '../../src/engine/types.ts';
import { arrange, startWith } from './helpers.ts';

const noMissions = () => {
  const setup = sampleSetup();
  for (const team of Object.values(setup.teams)) team.missions = [];
  return setup;
};

const ranks = (s: GameState) => Object.fromEntries(ranking(s).map((r) => [r.team, r.rank]));

describe('the result (criterion 15)', () => {
  it('score = map points + mission points', () => {
    const setup = sampleSetup();
    setup.teams.coral.missions = ['tower']; // +12
    setup.teams.blue.missions = ['tower']; // −6
    const { state } = startWith({ coral: ['5-5'] }, setup);
    const rows = ranking(state);
    expect(rows.find((r) => r.team === 'coral')).toMatchObject({ mapPoints: 6, missionPoints: 12, score: 18, rank: 1 });
    expect(rows.find((r) => r.team === 'blue')).toMatchObject({ mapPoints: 1, missionPoints: -6, score: -5 });
  });

  it('a tie on score goes to more plots, then more moves; still tied means a shared place', () => {
    // coral and blue: 6 points each. Coral has 3 plots, blue 2.
    let { state } = startWith({ coral: ['2-1', '3-3'], blue: ['5-5'] }, noMissions());
    expect(ranks(state)).toMatchObject({ coral: 1, blue: 2 });

    // Same points and plots: the most moves wins.
    state = startWith({ coral: ['2-1'], blue: ['1-8'] }, noMissions()).state;
    state.teams.blue.moveCount = 4;
    state.teams.coral.moveCount = 2;
    expect(ranks(state)).toMatchObject({ blue: 1, coral: 2 });

    // Still tied: they share the place.
    state.teams.coral.moveCount = 4;
    expect(ranks(state)).toEqual({ coral: 1, blue: 1, green: 3, gold: 3 });
  });

  it('extending adds days and the competition carries on', () => {
    const { setup, events } = lastDayScenario();
    const play = new Play(setup);
    for (const e of events) play.do(e);
    expect(() => play.do({ type: 'day/end' })).toThrow(RuleError); // last day: extend or announce
    play.do({ type: 'days/extend', count: 2 });
    expect(play.state).toMatchObject({ day: 6, days: 7, step: 'question' });
    expect(play.state.question.kind).toBe('group');
    play.question([]).endDay();
    expect(play.state.day).toBe(7);
    expect(populationHidden(play.state)).toBe(true);
  });

  it('extending only comes at the end of the last day', () => {
    const play = new Play(sampleSetup(9, 5)).do({ type: 'game/start' }).question([]);
    expect(() => play.do({ type: 'days/extend', count: 1 })).toThrow(RuleError);
  });
});

describe('the last days', () => {
  it('hides the population in the last three days', () => {
    const play = new Play(sampleSetup(9, 5)).do({ type: 'game/start' });
    const hidden: boolean[] = [];
    for (let day = 1; day <= 5; day++) {
      hidden.push(populationHidden(play.state));
      play.question([]);
      if (day < 5) play.endDay();
    }
    expect(hidden).toEqual([false, false, true, true, true]);
  });

  it('knows when the map is full', () => {
    const { state } = startWith();
    expect(isMapFull(state)).toBe(false);
    const all = state.setup.size === 9 ? Array.from({ length: 81 }, (_, i) => `${Math.floor(i / 9) + 1}-${(i % 9) + 1}`) : [];
    const full = arrange(state, { coral: all.filter((id) => !state.plots[id]?.owner) });
    expect(isMapFull(full)).toBe(true);
  });
});

describe('the announcement', () => {
  it('ends the competition at the end of a day, then steps through population, missions and podium', () => {
    const { setup, events } = lastDayScenario();
    const play = new Play(setup);
    for (const e of events) play.do(e);
    play.do({ type: 'game/end' });
    const steps = announcement(play.state);
    expect(steps[0]).toEqual({ kind: 'population' });
    expect(steps.at(-1)).toEqual({ kind: 'podium' });
    expect(steps.filter((s) => s.kind === 'mission')).toHaveLength(7); // 2 + 1 + 3 + 1 missions in the sample
    for (let i = 1; i < steps.length; i++) play.do({ type: 'announce/next' });
    expect(play.state.announce).toBe(steps.length - 1);
    expect(() => play.do({ type: 'announce/next' })).toThrow(RuleError);
  });

  it('cannot end in the middle of a day', () => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' });
    expect(() => play.do({ type: 'game/end' })).toThrow(RuleError);
  });
});
