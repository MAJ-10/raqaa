import { useEffect, useState } from 'react';
import { COUNTDOWN } from '../engine/timing.ts';

/**
 * The clock for what the display shows by time: it moves on when `next` says something comes or goes, so
 * the screen changes then. In between it may lag behind, which only keeps a fresh moment on screen.
 */
export function useClock(next: (now: number) => number | null): number {
  const [now, setNow] = useState(() => Date.now());
  const wake = next(now);
  useEffect(() => {
    if (wake === null) return;
    const id = setTimeout(() => setNow(Date.now()), Math.max(0, wake - Date.now()) + 20);
    return () => clearTimeout(id);
  }, [wake]);
  return now;
}

/** The clock, ticking while `running`: for what changes every few seconds, like the maths steps. */
export function useTicking(running: boolean, every = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [running, every]);
  return now;
}

/**
 * The seconds left before `until` (ms), from COUNTDOWN down to 1; 0 once it has come, or with nothing to
 * count (null). It counts from the referee's event, so a display that reopens carries on from the same second.
 */
export function useCountdown(until: number | null): number {
  // The clock looks again as each second turns.
  const now = useClock((t) => (until === null || t >= until ? null : until - (Math.ceil((until - t) / 1000) - 1) * 1000));
  return until === null ? 0 : Math.min(COUNTDOWN, Math.max(0, Math.ceil((until - now) / 1000)));
}
