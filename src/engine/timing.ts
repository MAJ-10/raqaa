// How the day's question and the auction's challenges are timed (decision, 18 November). Every screen,
// the demo and the tests read these, so a time is set in one place only.
import type { ChallengeType } from './types.ts';

/** Seconds the display counts down before a question or a challenge shows. */
export const COUNTDOWN = 3;

/** Seconds a group question runs, from when it shows. An individual question has no timer. */
export const QUESTION_SECONDS = 20;

/** Seconds a challenge runs, from when it shows. */
export const CHALLENGE_SECONDS = 20;

/** Memory: its items show for `show` seconds, then hide, and the teams have `write` seconds to write them. */
export const MEMORY = { show: 20, write: 10 } as const;

/** How long a challenge of this type runs, in seconds. */
export const challengeSeconds = (type: ChallengeType): number => (type === 'memory' ? MEMORY.show + MEMORY.write : CHALLENGE_SECONDS);

/** When something the referee shows at `at` (ms) appears on the display: after the countdown. */
export const afterCountdown = (at: number): number => at + COUNTDOWN * 1000;

/**
 * The clock a challenge shows at `now` (ms): from when it started, the whole of its time; for memory, its
 * showing time, then its writing time (`writing`).
 */
export function challengeClock(type: ChallengeType, startedAt: number, now: number): { startedAt: number; seconds: number; writing: boolean } {
  if (type !== 'memory') return { startedAt, seconds: CHALLENGE_SECONDS, writing: false };
  const writeAt = startedAt + MEMORY.show * 1000;
  return now < writeAt ? { startedAt, seconds: MEMORY.show, writing: false } : { startedAt: writeAt, seconds: MEMORY.write, writing: true };
}
