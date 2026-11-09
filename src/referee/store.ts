import type { GameEvent, Setup } from '../engine/types.ts';
import { loadGame } from '../state/persist.ts';
import { RefereeStore } from '../state/referee-store.ts';

let store: RefereeStore | undefined;

/** The referee window's single store, created on first use from the saved competition if there is one. */
export function getRefereeStore(): RefereeStore {
  store ??= new RefereeStore({ saved: loadGame<Setup, GameEvent>() });
  return store;
}
