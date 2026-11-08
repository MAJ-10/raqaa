// The ready-made scenarios play through the rules, and undo works on every event (criterion 16).
import { describe, expect, it } from 'vitest';
import { population, populationHidden } from '../../src/engine/select.ts';
import { reduce, replay } from '../../src/engine/reduce.ts';
import { lastDayScenario, openAuctionScenario, planScenario } from '../../src/engine/scenarios.ts';

describe('ready-made scenarios', () => {
  it('open auction: day 5, coral bids for 1-6 and leads 1–0', () => {
    const { state } = openAuctionScenario();
    expect(state.day).toBe(5);
    expect(state.step).toBe('auctions');
    const auction = state.auctions.find((a) => a.status === 'open')!;
    expect(auction).toMatchObject({ bidder: 'coral', defender: 'blue', plot: '1-6' });
    expect(auction.challenges.map((c) => c.winner)).toEqual(['coral', null]);
  });

  it('plan: blue lost an auction on a plan plot, and coral picks a plot of blue', () => {
    const { state } = planScenario();
    expect(state.pending).toEqual({ kind: 'planTake', team: 'coral', from: 'blue', plot: '2-4' });
    expect(state.plots['2-4']).toMatchObject({ owner: 'coral', plan: 'coral', planShown: true });
    expect(state.plots['3-4']).toMatchObject({ plan: 'coral', planShown: false });
  });

  it('last day: the day is over, population is hidden, and the referee extends or announces', () => {
    const { state } = lastDayScenario();
    expect(state).toMatchObject({ day: 5, days: 5, step: 'dayEnd' });
    expect(populationHidden(state)).toBe(true);
    expect(state.plots['1-6']?.owner).toBe('coral');
    expect(population(state, 'coral')).toBe(1100);
  });
});

describe('undo (criterion 16)', () => {
  it('removing the last event and folding again gives back the state before it, for every event', () => {
    for (const { setup, events } of [openAuctionScenario(), planScenario(), lastDayScenario()]) {
      let before = replay(setup, []);
      for (const event of events) {
        const after = reduce(before, event);
        expect(replay(setup, events.slice(0, events.indexOf(event)))).toEqual(before);
        before = after;
      }
    }
  });

  it('never changes the state it is given', () => {
    const { setup, events } = planScenario();
    const before = replay(setup, events.slice(0, -1));
    const copy = structuredClone(before);
    reduce(before, events.at(-1)!);
    expect(before).toEqual(copy);
  });
});
