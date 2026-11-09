/** Seconds left on a timer that started at startedAt (ms). Never below zero. */
export function secondsLeft(startedAt: number, seconds: number, now: number): number {
  return Math.max(0, Math.ceil(seconds - (now - startedAt) / 1000));
}
