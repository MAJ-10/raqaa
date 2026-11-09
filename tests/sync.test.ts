// The referee store and a display follower talking over a real BroadcastChannel (Node has one).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sampleSetup } from '../src/engine/scenarios.ts';
import type { GameEvent, GameState, Setup } from '../src/engine/types.ts';
import { followReferee } from '../src/state/follow-referee.ts';
import { loadGame, type SavedGame } from '../src/state/persist.ts';
import { RefereeStore, type DisplaySnapshot } from '../src/state/referee-store.ts';
import { isNewer, pickTransports, type Snapshot } from '../src/state/sync.ts';
import { memoryStorage } from './helpers.ts';

const start: GameEvent = { type: 'game/start', at: 1000 };
const kind: GameEvent = { type: 'question/kind', kind: 'individual', at: 1500 };
const numbers: GameEvent = { type: 'numbers/show', at: 2000 };

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

function referee(saved: SavedGame<Setup, GameEvent> | null = null, storage = memoryStorage()) {
  const store = new RefereeStore({ saved, storage, transports: ['broadcast'] });
  cleanups.push(() => store.close());
  return { store, storage };
}

function display() {
  const seen: DisplaySnapshot[] = [];
  cleanups.push(followReferee<GameState | null, GameEvent>((snapshot) => seen.push(snapshot), ['broadcast']));
  return { seen, latest: () => seen.at(-1) };
}

describe('referee store', () => {
  it('starts with no competition, and creates one from a setup', () => {
    const { store, storage } = referee();
    expect(store.getView().state).toBeNull();
    store.create(sampleSetup());
    expect(store.getView().state?.step).toBe('setup');
    expect(loadGame(storage)).toMatchObject({ setup: sampleSetup(), events: [] });
  });

  it('saves every setup change, and fixes the setup once the competition starts', () => {
    const { store, storage } = referee();
    store.create(sampleSetup());
    store.updateSetup({ ...sampleSetup(), days: 5 });
    expect(loadGame<Setup, GameEvent>(storage)?.setup.days).toBe(5);
    store.dispatch(start);
    expect(() => store.updateSetup(sampleSetup())).toThrow();
  });

  it('saves the events after every event, and undoes by folding again', () => {
    const { store, storage } = referee();
    store.create(sampleSetup());
    store.dispatch(start);
    store.dispatch(kind);
    store.dispatch(numbers);
    expect(loadGame(storage)?.events).toEqual([start, kind, numbers]);
    store.undo();
    expect(store.getView().events).toEqual([start, kind]);
    expect(store.getView().state?.question.numbers).toBeNull();
  });

  it('refuses an event that breaks a rule, and changes nothing', () => {
    const { store } = referee();
    store.create(sampleSetup());
    expect(() => store.dispatch(numbers)).toThrow();
    expect(store.getView().events).toEqual([]);
  });

  it('resumes a saved competition by folding its events', () => {
    const saved = { schema: 1, savedAt: 0, setup: sampleSetup(), events: [start, kind, numbers] };
    const { store } = referee(saved);
    expect(store.getView().state).toMatchObject({ day: 1, step: 'question' });
    expect(store.getView().state?.question.numbers).not.toBeNull();
  });

  it('resumes before a saved event that no longer follows the rules', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const saved = { schema: 1, savedAt: 0, setup: sampleSetup(), events: [start, start] };
    const { store } = referee(saved);
    expect(store.getView().events).toEqual([start]);
    log.mockRestore();
  });

  it('ending clears the competition and its save', () => {
    const { store, storage } = referee();
    store.create(sampleSetup());
    store.end();
    expect(store.getView().state).toBeNull();
    expect(loadGame(storage)).toBeNull();
  });
});

describe('window sync', () => {
  it('gives a display that opens the full state, with no event to replay', async () => {
    referee({ schema: 1, savedAt: 0, setup: sampleSetup(), events: [start] });
    const screen = display();
    await vi.waitFor(() => expect(screen.latest()?.state?.day).toBe(1));
    expect(screen.latest()?.last).toBeNull();
  });

  it('tells the display when there is no competition', async () => {
    referee();
    const screen = display();
    await vi.waitFor(() => expect(screen.latest()).toBeDefined());
    expect(screen.latest()?.state).toBeNull();
  });

  it('sends the display every change with the event that caused it', async () => {
    const { store } = referee();
    store.create(sampleSetup());
    const screen = display();
    await vi.waitFor(() => expect(screen.latest()?.state?.step).toBe('setup'));
    store.dispatch(start);
    await vi.waitFor(() => expect(screen.latest()?.state?.day).toBe(1));
    expect(screen.latest()?.last).toEqual(start);
    store.undo();
    await vi.waitFor(() => expect(screen.latest()?.state?.step).toBe('setup'));
    expect(screen.latest()?.last).toBeNull();
  });

  it('lets a display follow a referee window that reopens', async () => {
    const storage = memoryStorage();
    const first = referee(null, storage);
    first.store.create(sampleSetup());
    const screen = display();
    first.store.dispatch(start);
    first.store.dispatch(kind);
    await vi.waitFor(() => expect(screen.latest()?.state?.question.kind).toBe('individual'));
    first.store.close();
    // The reopened referee resumes from the save and has a new session.
    const second = referee(loadGame<Setup, GameEvent>(storage), storage);
    second.store.dispatch(numbers);
    await vi.waitFor(() => expect(screen.latest()?.state?.question.numbers).not.toBeNull());
  });
});

describe('snapshot order', () => {
  const snap = (session: string, seq: number): Snapshot<number, null> => ({ schema: 2, session, seq, state: seq, last: null });

  it('accepts the first snapshot, newer ones, and any from a new referee session', () => {
    expect(isNewer(snap('a', 1), null)).toBe(true);
    expect(isNewer(snap('a', 2), snap('a', 1))).toBe(true);
    expect(isNewer(snap('b', 1), snap('a', 9))).toBe(true);
  });

  it('ignores copies and older snapshots from the same session', () => {
    expect(isNewer(snap('a', 3), snap('a', 3))).toBe(false);
    expect(isNewer(snap('a', 2), snap('a', 3))).toBe(false);
  });
});

describe('transports', () => {
  it('uses both by default, and one alone when the address asks for it', () => {
    expect(pickTransports('')).toEqual(['broadcast', 'storage']);
    expect(pickTransports('?sync=storage')).toEqual(['storage']);
    expect(pickTransports('?sync=broadcast')).toEqual(['broadcast']);
  });
});
