// Saves the competition (its setup and every event) to localStorage after every event,
// so the referee can resume after closing the app or a power cut. There is no export or import:
// the save lasts until the competition ends, and at most two days after its last event.

/**
 * Raise this when the saved format changes, and teach loadGame to read the older versions.
 * 1: the Phase 1 demo counter. 2: a real competition (engine setup and events).
 */
export const SCHEMA_VERSION = 2;

const SAVE_KEY = 'raqaa.game';

export type SavedGame<Setup, Event> = {
  schema: number;
  savedAt: number;
  setup: Setup;
  events: Event[];
};

export function saveGame<Setup, Event>(
  game: { setup: Setup; events: readonly Event[] },
  storage: Storage = localStorage,
  now: number = Date.now(),
): boolean {
  const saved: SavedGame<Setup, Event> = {
    schema: SCHEMA_VERSION,
    savedAt: now,
    setup: game.setup,
    events: [...game.events],
  };
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(saved));
    return true;
  } catch (error) {
    console.error('Saving the competition failed', error);
    return false;
  }
}

/**
 * How long a competition stays saved after its last event. A competition is played in a day, so a save
 * left two days is one nobody will finish: the referee window opens on the landing page instead.
 */
export const KEEP_FOR = 2 * 24 * 60 * 60 * 1000;

/** The saved competition, or null when there is none, it can't be read by this version, or it is too old. */
export function loadGame<Setup, Event>(storage: Storage = localStorage, now: number = Date.now()): SavedGame<Setup, Event> | null {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const game = JSON.parse(raw) as Partial<SavedGame<Setup, Event>> | null;
    if (!game || game.schema !== SCHEMA_VERSION || !Array.isArray(game.events)) return null;
    if (typeof game.savedAt !== 'number' || now - game.savedAt > KEEP_FOR) {
      clearGame(storage);
      return null;
    }
    return game as SavedGame<Setup, Event>;
  } catch {
    return null;
  }
}

export function clearGame(storage: Storage = localStorage): void {
  storage.removeItem(SAVE_KEY);
}
