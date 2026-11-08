// The referee store and a display follower talking over a real BroadcastChannel (Node has one).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoInitial, demoReduce, demoSetup, type DemoEvent, type DemoState } from '../src/state/demo.ts';
import { followReferee } from '../src/state/follow-referee.ts';
import { loadGame } from '../src/state/persist.ts';
import { RefereeStore } from '../src/state/referee-store.ts';
import { isNewer, pickTransports, type Snapshot } from '../src/state/sync.ts';
import { memoryStorage } from './helpers.ts';

type DemoSnapshot = Snapshot<DemoState, DemoEvent>;

const add = (at: number): DemoEvent => ({ type: 'demo/add', amount: 1, at });

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

function referee(events: DemoEvent[] = [], storage = memoryStorage()) {
  const store = new RefereeStore({
    setup: demoSetup,
    initial: demoInitial,
    reduce: demoReduce,
    events,
    storage,
    transports: ['broadcast'],
  });
  cleanups.push(() => store.close());
  return { store, storage };
}

function display() {
  const seen: DemoSnapshot[] = [];
  cleanups.push(followReferee<DemoState, DemoEvent>((snapshot) => seen.push(snapshot), ['broadcast']));
  return { seen, latest: () => seen.at(-1) };
}

describe('referee store', () => {
  it('folds the events over the initial state, so it resumes a saved competition', () => {
    const { store } = referee([add(1), add(2), add(3)]);
    expect(store.getView().state).toEqual({ count: 3 });
    expect(store.getView().events).toHaveLength(3);
  });

  it('saves the setup and the events after every event', () => {
    const { store, storage } = referee();
    store.dispatch(add(1));
    store.dispatch(add(2));
    expect(loadGame(storage)).toMatchObject({ setup: demoSetup, events: [add(1), add(2)] });
  });

  it('undoes the last event by removing it and folding again', () => {
    const { store, storage } = referee([add(1), add(2)]);
    store.undo();
    expect(store.getView()).toEqual({ state: { count: 1 }, events: [add(1)] });
    expect(loadGame(storage)?.events).toEqual([add(1)]);
    store.undo();
    store.undo();
    expect(store.getView()).toEqual({ state: { count: 0 }, events: [] });
  });

  it('tells subscribers about every change', () => {
    const { store } = referee();
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch(add(1));
    store.undo();
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('window sync', () => {
  it('gives a display that opens the full state, with no event to replay', async () => {
    referee([add(1), add(2)]);
    const screen = display();
    await vi.waitFor(() => expect(screen.latest()?.state).toEqual({ count: 2 }));
    expect(screen.latest()?.last).toBeNull();
  });

  it('sends the display every change with the event that caused it', async () => {
    const { store } = referee();
    const screen = display();
    await vi.waitFor(() => expect(screen.latest()).toBeDefined());
    store.dispatch(add(7));
    await vi.waitFor(() => expect(screen.latest()?.state).toEqual({ count: 1 }));
    expect(screen.latest()?.last).toEqual(add(7));
    store.undo();
    await vi.waitFor(() => expect(screen.latest()?.state).toEqual({ count: 0 }));
    expect(screen.latest()?.last).toBeNull();
  });

  it('lets a display follow a referee window that reopens', async () => {
    const storage = memoryStorage();
    const first = referee([], storage);
    const screen = display();
    first.store.dispatch(add(1));
    await vi.waitFor(() => expect(screen.latest()?.state).toEqual({ count: 1 }));
    first.store.close();
    // The reopened referee resumes from the save and has a new session.
    const saved = loadGame<typeof demoSetup, DemoEvent>(storage);
    const second = referee(saved?.events, storage);
    second.store.dispatch(add(2));
    await vi.waitFor(() => expect(screen.latest()?.state).toEqual({ count: 2 }));
  });
});

describe('snapshot order', () => {
  const snap = (session: string, seq: number): DemoSnapshot => ({ session, seq, state: { count: seq }, last: null });

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
