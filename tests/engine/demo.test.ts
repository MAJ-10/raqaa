// Phase 7: the demo competition, which the referee window plays by itself on both screens.
import { describe, expect, it } from 'vitest';
import { BANKS } from '../../src/content/index.ts';
import { demoNext, seeded } from '../../src/engine/autoplay.ts';
import { getBoard } from '../../src/engine/board.ts';
import { announcement } from '../../src/engine/missions.ts';
import { initialState, reduce, replay } from '../../src/engine/reduce.ts';
import type { GameEvent, GameState, Setup } from '../../src/engine/types.ts';
import { demoSetup, isReady } from '../../src/state/setup.ts';

/** One demo, from «ابدأ» to the end: every move must be one the rules allow. */
function playDemo(setup: Setup, seed: number): { state: GameState; events: GameEvent[] } {
  const random = seeded(seed);
  let state = reduce(initialState(setup), { type: 'game/start', at: 0 });
  const events: GameEvent[] = [{ type: 'game/start', at: 0 }];
  for (let at = 1; at < 5000; at++) {
    const next = demoNext(state, random, BANKS);
    if (!next) return { state, events };
    const event = { ...next, at } as GameEvent;
    state = reduce(state, event); // throws if the demo made a move the rules refuse
    events.push(event);
  }
  throw new Error('The demo never ended');
}

describe('the demo competition', () => {
  it('is ready to start, marked as a demo, and carries no real question: its questions are sums', () => {
    const setup = demoSetup(seeded(1));
    expect(isReady(setup)).toBe(true);
    expect(setup.demo).toBe(true);
    for (const q of setup.questions) {
      const [, a, b] = q.text.match(/^كم يساوي (\d+) × (\d+)؟$/) ?? [];
      expect(Number(q.answer)).toBe(Number(a) * Number(b));
    }
  });

  it('plays itself from «ابدأ» to the podium on both maps, and shows the game: auctions and cards', { timeout: 60_000 }, () => {
    for (const size of [9, 7] as const) {
      let withAuction = 0;
      const cards = new Set<string>();
      for (let game = 0; game < 40; game++) {
        const setup = { ...demoSetup(seeded(size * 100 + game)), size };
        const { state, events } = playDemo(setup, size * 100 + game);
        expect(state.step).toBe('announce');
        expect(state.announce).toBe(announcement(state).length - 1); // the podium
        expect(replay(setup, events)).toEqual(state);
        if (events.some((e) => e.type === 'auction/open')) withAuction++;
        for (const e of events) {
          const card = e.type === 'build' ? getBoard(size).plots[e.plot]?.card : null;
          if (card) cards.add(card);
        }
      }
      expect(withAuction, `${size}×${size} demos with an auction`).toBeGreaterThanOrEqual(32);
      expect([...cards].sort(), `${size}×${size} cards taken`).toEqual(['bridge', 'crane', 'fence', 'inspector', 'plan']);
    }
  });
});
