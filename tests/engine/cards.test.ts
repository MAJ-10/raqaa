// Criteria 8 and 11: one card a day, and the secret plan. Also taking cards and the inspector.
import { describe, expect, it } from 'vitest';
import { RuleError } from '../../src/engine/reduce.ts';
import { planScenario, Play } from '../../src/engine/scenarios.ts';
import type { GameState, PlotId, Team } from '../../src/engine/types.ts';
import { copyState, give, startWith } from './helpers.ts';

function withPlan(state: GameState, team: Team, plots: PlotId[]): GameState {
  const s = copyState(state);
  for (const id of plots) s.plots[id]!.plan = team;
  return s;
}

describe('taking cards', () => {
  it('the first team to build on a card plot takes the card', () => {
    const play = startWith({ coral: ['3-3'] }).question(['coral']).build({ coral: ['2-3'] }); // fence on 2-3
    expect(play.state.teams.coral).toMatchObject({ cards: ['fence'], cardsTaken: 1 });
    expect(play.state.plots['2-3']?.card).toBeNull();
  });

  it('a bridge build takes the card too', () => {
    const play = startWith({ coral: ['2-1'] });
    play.state = give(play.state, 'coral', ['bridge']);
    play.question(['coral']).build({ coral: [{ build: '2-3', bridge: true }] });
    expect(play.state.teams.coral.cards).toEqual(['fence']);
  });

  it('taking a plot by auction gives no card', () => {
    const play = startWith({ coral: ['4-4'], blue: ['4-5'] });
    play.state.plots['4-5']!.card = 'crane'; // impossible in play, but proves the auction ignores it
    play.question(['coral']).build({ coral: [{ auction: '4-5' }] }).auction(['coral', 'coral']);
    expect(play.state.teams.coral.cards).toEqual([]);
  });
});

describe('one card a day (criterion 8)', () => {
  it('a second card the same day is refused, and allowed the next day', () => {
    const play = startWith({ coral: ['5-5'] });
    play.state = give(play.state, 'coral', ['crane', 'bridge']);
    play.question(['coral']).do({ type: 'card/crane', team: 'coral' });
    expect(() => play.do({ type: 'build', team: 'coral', plot: '5-7', via: 'bridge' })).toThrow(RuleError);
    play.build({ coral: [{ build: '5-6', inspect: 'blue' }, '6-6'] }).endDay(); // the inspector on 5-6 is not the day’s card
    play.question(['coral']).build({ coral: [{ build: '7-5', bridge: true }] });
    expect(play.state.plots['7-5']?.owner).toBe('coral');
  });

  it('each card is used once', () => {
    const play = startWith();
    play.state = give(play.state, 'coral', ['crane']);
    play.question(['coral']).build({ coral: ['crane', '1-2', '1-3'] }).endDay();
    play.question(['coral']);
    expect(() => play.do({ type: 'card/crane', team: 'coral' })).toThrow(RuleError);
  });

  it('a fence used in defence is the day’s card', () => {
    const play = startWith({ coral: ['4-4'], blue: ['4-5'] });
    play.state = give(play.state, 'blue', ['fence', 'crane']);
    play
      .question(['coral', 'blue'])
      .do({ type: 'auction/declare', team: 'coral', plot: '4-5' })
      .do({ type: 'card/fence', auction: 0 });
    expect(play.state.turn).toBe('blue');
    expect(() => play.do({ type: 'card/crane', team: 'blue' })).toThrow(RuleError);
  });

  it('the inspector is used as soon as it is taken, on another team, and is not the day’s card', () => {
    const play = startWith({ gold: ['5-3'] });
    play.state = give(play.state, 'gold', ['crane']);
    play.question(['gold']).do({ type: 'build', team: 'gold', plot: '5-4' }); // the inspector on 5-4
    expect(play.state.pending).toEqual({ kind: 'inspector', team: 'gold' });
    expect(() => play.do({ type: 'card/crane', team: 'gold' })).toThrow(RuleError); // the inspector comes first
    expect(() => play.do({ type: 'card/inspector', team: 'gold', target: 'gold' })).toThrow(RuleError);
    play.do({ type: 'card/inspector', team: 'gold', target: 'coral' });
    expect(play.state.inspections).toEqual([{ team: 'gold', target: 'coral', day: 1 }]);
    expect(play.state.teams.gold).toMatchObject({ cards: ['crane'], cardsTaken: 1, cardUsedToday: false });
    expect(play.state.pending).toBeNull();
    play.do({ type: 'card/crane', team: 'gold' }); // still free to use the day's card
    expect(() => play.do({ type: 'card/inspector', team: 'gold', target: 'blue' })).toThrow(RuleError); // used up
  });
});

describe('the secret plan (criterion 11)', () => {
  it('is placed on two of the team’s plots as soon as it is taken, and does not count as the day’s card', () => {
    const play = startWith({ coral: ['3-5', '2-5'] });
    play.state = give(play.state, 'coral', ['crane']);
    play.question(['coral']).do({ type: 'build', team: 'coral', plot: '4-5' }); // plan on 4-5
    expect(play.state.pending).toEqual({ kind: 'plan', team: 'coral' });
    expect(() => play.do({ type: 'card/plan', team: 'coral', plots: ['1-1', '4-5'] })).toThrow(RuleError); // base
    play.do({ type: 'card/plan', team: 'coral', plots: ['3-5', '4-5'] });
    expect(play.state.plots['3-5']).toMatchObject({ plan: 'coral', planShown: false });
    expect(play.state.teams.coral).toMatchObject({ cardUsedToday: false, cardsTaken: 1, cards: ['crane'] });
    play.do({ type: 'card/crane', team: 'coral' }); // still free to use a card today
  });

  it('fires when a bidder loses on it: the owner takes a plot of the bidder next to it', () => {
    const { state, setup, events } = planScenario();
    expect(state.pending).toMatchObject({ kind: 'planTake', team: 'coral', from: 'blue' });
    const play = new Play(setup);
    for (const e of events) play.do(e);
    expect(() => play.do({ type: 'plan/take', team: 'coral', plot: '1-5' })).toThrow(RuleError); // not next to 2-4
    play.do({ type: 'plan/take', team: 'coral', plot: '2-5' });
    expect(play.state.plots['2-5']).toMatchObject({ owner: 'coral', since: 6 });
    expect(play.state.teams.coral.takenFrom).toEqual(['blue']);
    expect(play.state.step).toBe('dayEnd');
  });

  it('fires every time a bidder loses on either plot, and never takes a base', () => {
    const play = startWith({ blue: ['4-5', '4-6'], coral: ['4-4', '3-5'] });
    play.state = withPlan(play.state, 'blue', ['4-5', '4-6']);
    play.question(['coral']).build({ coral: [{ auction: '4-5' }] }).auction(['blue', 'blue'], '4-4');
    expect(play.state.plots['4-4']?.owner).toBe('blue');
    play.endDay().question(['coral']).build({ coral: [{ auction: '4-5' }] }).auction(['blue', 'blue'], '3-5');
    expect(play.state.plots['3-5']?.owner).toBe('blue');
    expect(play.state.plots['4-5']?.plan).toBe('blue');
  });

  it('gives nothing when the bidder has no plot next to it but its base', () => {
    const play = startWith({ blue: ['1-2'] });
    play.state = withPlan(play.state, 'blue', ['1-2']);
    play.question(['coral']).build({ coral: [{ auction: '1-2' }] }).auction(['blue', 'blue']);
    expect(play.state.pending).toBeNull();
    expect(play.state.plots['1-2']?.planShown).toBe(true);
    expect(play.state.step).toBe('dayEnd');
  });

  it('leaves a plot the bidder wins, and stays on the other', () => {
    const play = startWith({ blue: ['4-5', '4-6'], coral: ['4-4'] });
    play.state = withPlan(play.state, 'blue', ['4-5', '4-6']);
    play.question(['coral']).build({ coral: [{ auction: '4-5' }] }).auction(['coral', 'coral']);
    expect(play.state.plots['4-5']).toMatchObject({ owner: 'coral', plan: null });
    expect(play.state.plots['4-6']?.plan).toBe('blue');
  });

  it('cancels a declared auction on the plot it takes; the bidder’s move is lost (decision)', () => {
    // Coral bids first, on blue's plan plot 4-5, and loses. Green bid next for coral's 3-5,
    // but the plan gives 3-5 to blue before green's auction opens.
    const play = startWith({ blue: ['4-5'], coral: ['3-5'], green: ['3-6', '9-2'] });
    play.state = withPlan(play.state, 'blue', ['4-5']);
    play.question(['coral', 'green']).build({ coral: [{ auction: '4-5' }], green: [{ auction: '3-5' }] });
    expect(play.state.auctions.map((a) => a.bidder)).toEqual(['coral', 'green']);
    play.auction(['blue', 'blue'], '3-5');
    expect(play.state.plots['3-5']?.owner).toBe('blue');
    expect(play.state.auctions[1]?.status).toBe('cancelled');
    expect(play.state.teams.green).toMatchObject({ moves: 0, moveCount: 1, bidderCounter: 1 });
    expect(play.state.step).toBe('dayEnd');
  });
});
