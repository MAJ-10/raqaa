import { useEffect, useState } from 'react';
import { formatNumber } from './number.ts';
import { secondsLeft } from './time.ts';

/**
 * A countdown drawn as a ring with the seconds left. It counts from the event's time, so a display that
 * reopens in the middle carries on from the same second.
 */
export function Timer({ startedAt, seconds = 45, size = 64 }: { startedAt: number; seconds?: number; size?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const left = secondsLeft(startedAt, seconds, now);
  const radius = 20;
  const length = 2 * Math.PI * radius;
  return (
    <span className="timer" data-ending={left <= 5 || undefined} style={{ width: size, height: size }} role="timer">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={radius} className="timer-track" />
        <circle
          cx="24"
          cy="24"
          r={radius}
          className="timer-left"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - left / seconds)}
        />
      </svg>
      <span className="timer-number">{formatNumber(left)}</span>
    </span>
  );
}
