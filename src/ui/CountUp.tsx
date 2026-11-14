import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from './motion.ts';
import { formatNumber } from './number.ts';

/**
 * A number that counts to its new value when it changes, instead of jumping (unless motion is reduced).
 * `delay` holds the old value a while first, so the count can start with what brought it. `from` makes it
 * count from that number when it first shows, and `duration` sets how long a count takes.
 */
export function CountUp({ value, delay = 0, from = value, duration = 700 }: { value: number; delay?: number; from?: number; duration?: number }) {
  const [shown, setShown] = useState(from);
  // The value last drawn, read and written only while counting.
  const last = useRef(from);
  const still = reducedMotion();

  useEffect(() => {
    const start = last.current;
    if (still || start === value) {
      last.current = value;
      return;
    }
    let frame = 0;
    const wait = setTimeout(() => {
      const began = performance.now();
      frame = requestAnimationFrame(function tick(now) {
        const t = Math.min(1, (now - began) / duration);
        last.current = Math.round(start + (value - start) * (1 - Math.pow(1 - t, 3)));
        setShown(last.current);
        if (t < 1) frame = requestAnimationFrame(tick);
      });
    }, delay);
    return () => {
      clearTimeout(wait);
      cancelAnimationFrame(frame);
    };
  }, [value, still, delay, duration]);

  return <>{formatNumber(still ? value : shown)}</>;
}
