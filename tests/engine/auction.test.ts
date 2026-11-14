// Criteria 4, 5, 9, 10 and 12: auctions, the fence and the player counters. And the auction decisions.
import { describe, expect, it } from 'vitest';
import { RuleError } from '../../src/engine/reduce.ts';
import { Play, sampleSetup } from '../../src/engine/scenarios.ts';
import { canAuction } from '../../src/engine/select.ts';
import type { ChallengeContent } from '../../src/engine/types.ts';
import { give, startWith } from './helpers.ts';

describe('what can be auctioned (criteria 4 and 5)', () => {
  it('a base, never (criterion 4)', () => {
    const { state } = startWith({ coral: ['1-8'] });
    expect(canAuction(state, 'coral', '1-9')).toBe(false);
  });

  it('a plot built or taken today or yesterday, no (criterion 5)', () => {
    const play = startWith({ coral: ['4-4'], blue: [['4-5', 1]] });
    expect(canAuction(play.state, 'coral', '4-5')).toBe(false); // today
    play.question([]).endDay();
    expect(canAuction(play.state, 'coral', '4-5')).toBe(false); // yesterday
    play.question([]).endDay();
    expect(canAuction(play.state, 'coral', '4-5')).toBe(true); // the day after
  });

  it('a plot that already has an auction declared today, no (criterion 5)', () => {
    const play = startWith({ coral: ['4-4'], blue: ['4-5'], green: ['3-5'] }).question(['coral', 'green']);
    expect(canAuction(play.state, 'green', '4-5')).toBe(true);
    play.build({ coral: [{ auction: '4-5' }], green: ['3-6'] });
    expect(canAuction(play.state, 'green', '4-5')).toBe(false);
  });

  it('only another team’s plot next to the bidder', () => {
    const { state } = startWith({ coral: ['4-4'], blue: ['4-5', '6-6'] });
    expect(canAuction(state, 'coral', '4-5')).toBe(true);
    expect(canAuction(state, 'coral', '6-6')).toBe(false); // not next to coral
    expect(canAuction(state, 'coral', '4-4')).toBe(false); // its own
  });
});

describe('the fence (criterion 9)', () => {
  it('cancels the auction when it is declared, and the bidder loses the move', () => {
    const play = startWith({ coral: ['4-4'], blue: ['4-5'] });
    play.state = give(play.state, 'blue', ['fence']);
    play.question(['coral']).do({ type: 'auction/declare', team: 'coral', plot: '4-5' });
    expect(play.state.pending).toEqual({ kind: 'fence', auction: 0 });
    play.do({ type: 'card/fence', auction: 0 });
    expect(play.state.auctions[0]?.status).toBe('fenced');
    expect(play.state.teams.coral.moves).toBe(0);
    expect(play.state.teams.blue).toMatchObject({ cards: [], cardUsedToday: true });
    // Nothing is left to play, no player counter moved.
    expect(play.state.step).toBe('dayEnd');
    expect(play.state.teams.coral.bidderCounter).toBe(1);
    expect(play.state.teams.blue.bidderCounter).toBe(1);
  });

  it('can be kept: "no fence" lets the auction go ahead', () => {
    const play = startWith({ coral: ['4-4'], blue: ['4-5'] });
    play.state = give(play.state, 'blue', ['fence']);
    play.question(['coral']).build({ coral: [{ auction: '4-5', fence: false }] });
    expect(play.state.auctions[0]?.status).toBe('declared');
    expect(play.state.teams.blue.cards).toEqual(['fence']);
  });

  it('is not offered to a defender who used a card today', () => {
    const play = startWith({ coral: ['4-4'], blue: ['4-5'] });
    play.state = give(play.state, 'blue', ['fence']);
    play.question(['coral']);
    play.state.teams.blue.cardUsedToday = true; // as after a crane in its turn earlier today
    play.do({ type: 'auction/declare', team: 'coral', plot: '4-5' });
    expect(play.state.pending).toBeNull();
  });
});

describe('playing an auction (criterion 10)', () => {
  const declared = () => startWith({ coral: ['4-4'], blue: ['4-5'] }).question(['coral']).build({ coral: [{ auction: '4-5' }] });

  it('ends as soon as one side wins two challenges', () => {
    const play = declared().auction(['coral', 'coral']);
    expect(play.state.auctions[0]).toMatchObject({ status: 'done', winner: 'coral' });
    expect(play.state.plots['4-5']).toMatchObject({ owner: 'coral', since: 1 });
    expect(play.state.step).toBe('dayEnd');
    expect(() => play.do({ type: 'challenge/start', auction: 0, content: { type: 'precision' } })).toThrow(RuleError);
  });

  it('goes to a third challenge at one each; the defender keeps the plot when it wins', () => {
    const play = declared().auction(['coral', 'blue', 'blue']);
    expect(play.state.auctions[0]).toMatchObject({ status: 'done', winner: 'blue' });
    expect(play.state.plots['4-5']?.owner).toBe('blue');
    expect(play.state.teams.coral).toMatchObject({ moves: 0, bidderWins: 0 });
  });

  it('replays a tied challenge with new content of the same type', () => {
    const play = declared().do({ type: 'auction/open', auction: 0 });
    const math: ChallengeContent = { type: 'math', start: 4, steps: [{ op: '+', n: 3 }], answer: 7 };
    play.do({ type: 'challenge/start', auction: 0, content: math });
    expect(() => play.do({ type: 'challenge/replay', auction: 0, content: { type: 'precision' } })).toThrow(RuleError);
    const again: ChallengeContent = { type: 'math', start: 9, steps: [{ op: '-', n: 2 }], answer: 7 };
    play.do({ type: 'challenge/replay', auction: 0, content: again });
    const challenges = play.state.auctions[0]!.challenges;
    expect(challenges).toHaveLength(1);
    expect(challenges[0]?.content).toEqual(again);
  });

  it('runs the precision challenge with no timer (a saved timer end of it changes nothing)', () => {
    const play = declared().do({ type: 'auction/open', auction: 0 });
    play.do({ type: 'challenge/start', auction: 0, content: { type: 'precision' } });
    expect(play.state.timer).toBeNull();
    play.do({ type: 'timer/end' });
    expect(play.state.auctions[0]?.challenges[0]).toMatchObject({ stopped: false, winner: null });
    play.do({ type: 'challenge/replay', auction: 0, content: { type: 'precision' } });
    expect(play.state.timer).toBeNull();
    const math: ChallengeContent = { type: 'math', start: 4, steps: [{ op: '+', n: 1 }], answer: 5 };
    play.do({ type: 'challenge/result', auction: 0, winner: 'blue' }).do({ type: 'challenge/start', auction: 0, content: math });
    expect(play.state.timer).toMatchObject({ kind: 'challenge' });
  });

  it('the timer stops the challenge, and the referee still picks the winner', () => {
    const play = declared().do({ type: 'auction/open', auction: 0 });
    play.do({ type: 'challenge/start', auction: 0, content: { type: 'building' } }).do({ type: 'timer/end' });
    expect(play.state.auctions[0]?.challenges[0]).toMatchObject({ stopped: true, winner: null });
    play.do({ type: 'challenge/result', auction: 0, winner: 'blue' });
    expect(play.state.auctions[0]?.challenges[0]?.winner).toBe('blue');
  });

  it('only one of the two sides can win', () => {
    const play = declared().do({ type: 'auction/open', auction: 0 });
    play.do({ type: 'challenge/start', auction: 0, content: { type: 'precision' } });
    expect(() => play.do({ type: 'challenge/result', auction: 0, winner: 'gold' })).toThrow(RuleError);
  });
});

describe('player counters (criterion 12)', () => {
  it('the question counter turns over each team’s players, on individual questions only', () => {
    const play = new Play(sampleSetup(9, 12)).do({ type: 'game/start' });
    const coral: number[] = [];
    const blue: number[] = [];
    for (let day = 1; day <= 9; day++) {
      const kind = day % 2 === 1 ? 'individual' : 'group';
      play.do({ type: 'question/kind', kind });
      if (kind === 'individual') {
        play.do({ type: 'numbers/show' });
        coral.push(play.state.question.numbers!.coral);
        blue.push(play.state.question.numbers!.blue);
      }
      play.do({ type: 'question/show' }).do({ type: 'answer/show' }).do({ type: 'permits/set', teams: [] }).endDay();
    }
    expect(coral).toEqual([1, 2, 3, 1, 2]); // 3 players
    expect(blue).toEqual([1, 2, 3, 4, 1]); // 4 players
  });

  it('the bidder counter moves for both sides of every auction, even two in one day', () => {
    // Blue defends twice on day 1: against coral, then against green.
    const play = startWith({ coral: ['4-4'], blue: ['4-5', '6-5'], green: ['6-4'] })
      .question(['coral', 'green'])
      .build({ coral: [{ auction: '4-5' }], green: [{ auction: '6-5' }] });
    const [first, second] = play.state.auctions.map((a) => a.id);
    play.auction(['blue', 'blue']);
    play.auction(['blue', 'blue']);
    const auctions = play.state.auctions;
    expect(auctions.find((a) => a.id === first)?.players).toEqual({ bidder: 1, defender: 1 });
    expect(auctions.find((a) => a.id === second)?.players).toEqual({ bidder: 1, defender: 2 });
    expect(play.state.teams.blue.bidderCounter).toBe(3);
  });

  it('keeps the same two players for every challenge of an auction', () => {
    const play = startWith({ coral: ['4-4'], blue: ['4-5'] }).question(['coral']).build({ coral: [{ auction: '4-5' }] });
    play.do({ type: 'auction/open', auction: 0 });
    const players = play.state.auctions[0]?.players;
    play.do({ type: 'challenge/start', auction: 0, content: { type: 'precision' } }).do({ type: 'challenge/result', auction: 0, winner: 'blue' });
    play.do({ type: 'challenge/start', auction: 0, content: { type: 'precision' } });
    expect(play.state.auctions[0]?.players).toEqual(players);
  });
});

describe('auction decisions', () => {
  it('auctions open in the order they were declared', () => {
    const play = startWith({ coral: ['4-4'], blue: ['4-5', '6-5'], green: ['6-4'] })
      .question(['coral', 'green'])
      .build({ coral: [{ auction: '4-5' }], green: [{ auction: '6-5' }] });
    const [first, second] = play.state.auctions;
    expect(() => play.do({ type: 'auction/open', auction: second!.id })).toThrow(RuleError);
    play.do({ type: 'auction/open', auction: first!.id });
  });

  it('goes ahead when the bidder lost the plot it touched in an earlier auction', () => {
    // Green moves first (fewer points) and bids for coral's 4-4; coral then bids from 4-4 for blue's 4-5.
    const play = startWith({ coral: ['4-4'], blue: ['4-5'], green: ['3-4'] })
      .question(['coral', 'green'])
      .build({ green: [{ auction: '4-4' }], coral: [{ auction: '4-5' }] });
    expect(play.state.auctions.map((a) => a.bidder)).toEqual(['green', 'coral']);
    play.auction(['green', 'green']); // coral loses 4-4 and no longer touches 4-5
    expect(play.state.plots['4-4']?.owner).toBe('green');
    play.auction(['coral', 'coral']);
    expect(play.state.plots['4-5']?.owner).toBe('coral');
  });
});
