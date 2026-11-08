import { isNewer, makeId, openSyncLink, type Snapshot, type SyncMessage, type Transport } from './sync.ts';

/**
 * Used by a display window: asks the referee for the full state, then reports every newer snapshot.
 * The display never sends anything else, so it can't change the competition.
 */
export function followReferee<State, Event>(
  onSnapshot: (snapshot: Snapshot<State, Event>) => void,
  transports?: Transport[],
): () => void {
  let current: Snapshot<State, Event> | null = null;
  const link = openSyncLink<SyncMessage<State, Event>>((message) => {
    if (message.type !== 'snapshot' || !isNewer(message.snapshot, current)) return;
    current = message.snapshot;
    onSnapshot(message.snapshot);
  }, transports);
  link.send({ type: 'hello', id: makeId() });
  return () => link.close();
}
