// Criterion 13: content never repeats, memory alternates images and words, and mental math is sound.
// Challenge types are random (decision).
import { describe, expect, it } from 'vitest';
import { makeContent, makeMath, newChallenge, pickFresh, scramble, solveMath, type Banks } from '../../src/engine/content.ts';
import { initialState, replay } from '../../src/engine/reduce.ts';
import { openAuctionScenario, Play, sampleSetup } from '../../src/engine/scenarios.ts';
import { CHALLENGES, type ChallengeContent } from '../../src/engine/types.ts';
import { seeded } from '../../src/engine/autoplay.ts';
import { startWith } from './helpers.ts';

const ids = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);

const banks: Banks = {
  spelling: ids('s', 5),
  ordering: ids('o', 3).map((id) => ({ id, length: 5 })),
  images: ids('i', 20),
  words: ids('w', 20),
};

describe('mental math', () => {
  it('starts from 2 to 20, has 3 to 5 steps, and every result is a whole number from 1 to 100', () => {
    const random = seeded(7);
    for (let i = 0; i < 2000; i++) {
      const math = makeMath(random);
      expect(math.start).toBeGreaterThanOrEqual(2);
      expect(math.start).toBeLessThanOrEqual(20);
      expect(math.steps.length).toBeGreaterThanOrEqual(3);
      expect(math.steps.length).toBeLessThanOrEqual(5);
      let value = math.start;
      for (const { op, n } of math.steps) {
        if (op === '+' || op === '-') expect(n).toBeLessThanOrEqual(20);
        else expect([2, 3, 4, 5]).toContain(n);
        value = op === '+' ? value + n : op === '-' ? value - n : op === '*' ? value * n : value / n;
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(100);
      }
      expect(math.answer).toBe(value);
      expect(solveMath(math)).toBe(value);
    }
  });

  it('uses all four operations', () => {
    const random = seeded(3);
    const ops = new Set(Array.from({ length: 200 }, () => makeMath(random).steps.map((s) => s.op)).flat());
    expect([...ops].sort()).toEqual(['*', '+', '-', '/']);
  });
});

describe('no repeats (criterion 13)', () => {
  it('never shows an item twice while the bank has fresh ones', () => {
    const random = seeded(11);
    const used: string[] = [];
    for (let i = 0; i < 5; i++) {
      const { items, recycled } = pickFresh(banks.spelling, used, 1, random);
      expect(used).not.toContain(items[0]);
      expect(recycled).toBe(false);
      used.push(...items);
    }
    expect(new Set(used).size).toBe(5);
  });

  it('when the bank runs out, brings back the item shown longest ago and says so (decision)', () => {
    const { items, recycled } = pickFresh(['a', 'b', 'c'], ['b', 'c', 'a'], 1, seeded(1));
    expect(items).toEqual(['b']);
    expect(recycled).toBe(true);
  });

  it('a competition never repeats a spelling word, replays included', () => {
    const play = startWith({ coral: ['4-4'], blue: ['4-5'] }).question(['coral']).build({ coral: [{ auction: '4-5' }] });
    play.do({ type: 'auction/open', auction: 0 });
    const random = seeded(5);
    const spelling = () => makeContent(play.state, 'spelling', banks, random).content;
    play.do({ type: 'challenge/start', auction: 0, content: spelling() });
    play.do({ type: 'challenge/replay', auction: 0, content: spelling() }); // a tie
    play.do({ type: 'challenge/result', auction: 0, winner: 'coral' });
    play.do({ type: 'challenge/start', auction: 0, content: spelling() });
    const words = play.state.used.spelling;
    expect(words).toHaveLength(3);
    expect(new Set(words).size).toBe(3);
  });

  it('scrambles a sentence into an order that is never the right one', () => {
    const random = seeded(2);
    for (let i = 0; i < 200; i++) {
      const order = scramble(4, random);
      expect([...order].sort()).toEqual([0, 1, 2, 3]);
      expect(order).not.toEqual([0, 1, 2, 3]);
    }
  });
});

describe('memory alternates images and words (criterion 13)', () => {
  it('8 images, then 8 words, then 8 images', () => {
    const play = startWith({ coral: ['4-4'], blue: ['4-5'] }).question(['coral']).build({ coral: [{ auction: '4-5' }] });
    play.do({ type: 'auction/open', auction: 0 });
    const random = seeded(9);
    const kinds: string[] = [];
    for (const winner of ['coral', 'blue', 'coral'] as const) {
      const { content } = makeContent(play.state, 'memory', banks, random);
      if (content.type !== 'memory') throw new Error('memory expected');
      expect(content.items).toHaveLength(8);
      kinds.push(content.kind);
      play.do({ type: 'challenge/start', auction: 0, content }).do({ type: 'challenge/result', auction: 0, winner });
    }
    expect(kinds).toEqual(['images', 'words', 'images']);
    expect(new Set(play.state.used.images).size).toBe(16);
  });
});

describe('random challenge types (decision)', () => {
  it('draws every one of the six types', () => {
    const state = initialState(sampleSetup());
    const random = seeded(4);
    const types = new Set(Array.from({ length: 300 }, () => newChallenge(state, banks, random).content.type));
    expect([...types].sort()).toEqual([...CHALLENGES].sort());
  });

  it('replaying the events gives the same challenges, because the content lives in the events', () => {
    // The open-auction scenario, just before its second challenge starts.
    const scenario = openAuctionScenario();
    const play = new Play(scenario.setup);
    for (const event of scenario.events.slice(0, -1)) play.do(event);
    const auction = play.state.auctions.find((a) => a.status === 'open')!.id;
    const content: ChallengeContent = newChallenge(play.state, banks).content; // Math.random
    play.do({ type: 'challenge/start', auction, content });
    const again = replay(scenario.setup, play.events);
    expect(again.auctions[auction]?.challenges[1]?.content).toEqual(content);
  });
});
