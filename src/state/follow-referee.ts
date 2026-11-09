import { SCHEMA_VERSION } from './persist.ts';
import {
  isNewer,
  makeId,
  openSyncLink,
  pickTransports,
  readLastSnapshot,
  type Snapshot,
  type SyncMessage,
  type Transport,
} from './sync.ts';

/**
 * Used by a display window. It shows the last state the referee sent, even when the referee window is
 * closed, then asks the referee for the full state and reports every newer snapshot. Snapshots from
 * another version of the app are ignored. The display never sends anything else, so it can't change
 * the competition.
 */
export function followReferee<State, Event>(
  onSnapshot: (snapshot: Snapshot<State, Event>) => void,
  transports: Transport[] = pickTransports(),
): () => void {
  let current: Snapshot<State, Event> | null = null;

  // A display that opens draws the state as it is, without replaying the event that led to it.
  const saved = transports.includes('storage') ? readLastSnapshot<State, Event>(SCHEMA_VERSION) : null;
  if (saved) {
    current = { ...saved, last: null };
    onSnapshot(current);
  }

  const link = openSyncLink<SyncMessage<State, Event>>((message) => {
    if (message.type !== 'snapshot') return;
    const next = message.snapshot;
    if (next.schema !== SCHEMA_VERSION || !isNewer(next, current)) return;
    current = next;
    onSnapshot(next);
  }, transports);
  link.send({ type: 'hello', id: makeId() });
  return () => link.close();
}
