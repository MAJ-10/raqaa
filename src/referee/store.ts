import type { GameEvent, Setup } from '../engine/types.ts';
import { loadGame } from '../state/persist.ts';
import { RefereeStore } from '../state/referee-store.ts';

let store: RefereeStore | undefined;

/**
 * The referee window's single store, created on first use from the saved competition if there is one.
 * A timer that was running when the window closed starts again from the full time (decision).
 */
export function getRefereeStore(): RefereeStore {
  if (!store) {
    store = new RefereeStore({ saved: loadGame<Setup, GameEvent>() });
    if (store.getView().state?.timer) store.dispatch({ type: 'timer/restart', at: Date.now() });
  }
  return store;
}
