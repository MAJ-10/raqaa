import { useEffect, useState } from 'react';
import { followReferee } from '../state/follow-referee.ts';
import type { Snapshot } from '../state/sync.ts';

/** The latest snapshot from the referee window, or null until the referee answers. */
export function useRefereeSnapshot<State, Event>(): Snapshot<State, Event> | null {
  const [snapshot, setSnapshot] = useState<Snapshot<State, Event> | null>(null);
  useEffect(() => followReferee<State, Event>(setSnapshot), []);
  return snapshot;
}
