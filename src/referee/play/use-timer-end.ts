import { useEffect, useRef } from 'react';
import type { EventInput, GameState } from '../../engine/types.ts';

const TIMER_MS = 45_000;

/**
 * When the question or challenge timer reaches zero, the referee window records timer/end once.
 * A timer that had already run out when it came on screen (after an undo) is left for the referee,
 * so an undo of timer/end isn't undone again at once.
 */
export function useTimerEnd(state: GameState, act: (event: EventInput) => void): void {
  const startedAt = state.timer?.startedAt ?? null;
  const live = useRef(new Set<number>());
  const fired = useRef(new Set<number>());

  useEffect(() => {
    if (startedAt === null) return;
    const left = startedAt + TIMER_MS - Date.now();
    if (left > 0) live.current.add(startedAt);
    if (!live.current.has(startedAt)) return;
    const id = setTimeout(() => {
      if (fired.current.has(startedAt)) return;
      fired.current.add(startedAt);
      act({ type: 'timer/end' });
    }, Math.max(0, left));
    return () => clearTimeout(id);
  }, [startedAt, act]);
}
