import { useEffect, useRef, useState } from 'react';
import { reducedMotion } from './motion.ts';
import { formatNumber } from './number.ts';

const DURATION = 700;

/** A number that counts to its new value when it changes, instead of jumping (unless motion is reduced). */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  // The value last drawn, read and written only while counting.
  const last = useRef(value);
  const still = reducedMotion();

  useEffect(() => {
    const start = last.current;
    if (still || start === value) {
      last.current = value;
      return;
    }
    const began = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - began) / DURATION);
      last.current = Math.round(start + (value - start) * (1 - Math.pow(1 - t, 3)));
      setShown(last.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, still]);

  return <>{formatNumber(still ? value : shown)}</>;
}
