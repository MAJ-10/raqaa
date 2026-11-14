// A demo plays itself: a while after each event comes the next, chosen by the engine (autoplay.ts), paced
// so the display shows each moment through: a window, a building that lands, a card that turns over.
import { useEffect } from 'react';
import { BANKS } from '../../content/index.ts';
import { AUCTION_LAND, CARD_TIME, MATH_STEP_TIME, PERMITS_TIME, waitOf } from '../../display/windows.ts';
import { demoNext } from '../../engine/autoplay.ts';
import { getBoard } from '../../engine/board.ts';
import type { EventInput, GameEvent, GameState } from '../../engine/types.ts';

/** How long the demo leaves a moment on screen before its next move, in ms. */
function hold(state: GameState, e: GameEvent): number {
  switch (e.type) {
    case 'question/kind':
      return 1200;
    case 'numbers/show':
    case 'answer/show':
      return 3000;
    case 'question/show':
    case 'question/outside':
      return 4500;
    case 'permits/set':
      return PERMITS_TIME + 600;
    case 'build': {
      const card = e.via === 'bridge' || getBoard(state.setup.size).plots[e.plot]?.card;
      return waitOf(e) + (card ? CARD_TIME + 600 : 1200);
    }
    case 'card/fence':
    case 'card/crane':
    case 'card/inspector':
    case 'plan/take':
      return CARD_TIME + 600;
    case 'challenge/start':
    case 'challenge/replay':
      // Mental maths: until every step is out and the question mark has had a moment.
      return e.content.type === 'math' ? (e.content.steps.length + 1) * MATH_STEP_TIME + 1500 : 6000;
    case 'challenge/result':
      // A won auction: its window, then its plot landing on the map.
      return state.auctions[e.auction]?.status === 'done' ? AUCTION_LAND + 1400 : 2500;
    case 'game/end':
    case 'announce/next':
      return 5500;
    default:
      return 2200;
  }
}

/** While `playing`, makes the demo's next move once the last one has had its moment. */
export function useDemo(playing: boolean, state: GameState, events: readonly GameEvent[], act: (event: EventInput) => void): void {
  useEffect(() => {
    if (!playing) return;
    const last = events.at(-1);
    const wait = last ? Math.max(300, last.at + hold(state, last) - Date.now()) : 1000;
    const timer = window.setTimeout(() => {
      const next = demoNext(state, Math.random, BANKS);
      if (next) act(next);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [playing, state, events, act]);
}
