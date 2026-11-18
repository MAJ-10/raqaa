/** Seconds left on a timer that starts at startedAt (ms): all of them until it starts, never below zero. */
export function secondsLeft(startedAt: number, seconds: number, now: number): number {
  return Math.min(seconds, Math.max(0, Math.ceil(seconds - (now - startedAt) / 1000)));
}
