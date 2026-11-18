// The few seconds the display counts before a question or a challenge shows (decision, 18 November), so
// every eye is on the screen when it comes.
import { useLayoutEffect, useRef } from 'react';
import { EASE_BOUNCE, motion } from '../ui/motion.ts';
import { formatNumber } from '../ui/number.ts';

/** The ring's length, for a radius of 46 on its 100 grid. */
const RING = 2 * Math.PI * 46;

/**
 * The number counting down (`left`, from useCountdown): each one pops in as its second starts, while the
 * ring runs round it once. Not the first one on a display that reopens (`live` is false then).
 */
export function Countdown({ left, live }: { left: number; live: boolean }) {
  const box = useRef<HTMLSpanElement>(null);
  const came = useRef(live);
  useLayoutEffect(() => {
    if (!came.current) {
      came.current = true;
      return;
    }
    const node = box.current;
    motion(node?.querySelector('.countdown-number'), [{ opacity: 0, transform: 'scale(1.8)' }, { opacity: 1, transform: 'none' }], {
      duration: 460,
      easing: EASE_BOUNCE,
    });
    motion(node?.querySelector('.countdown-ring'), [{ strokeDashoffset: 0 }, { strokeDashoffset: RING }], { duration: 1000, easing: 'linear', fill: 'forwards' });
  }, [left]);
  return (
    <span ref={box} className="countdown" role="timer" aria-label={formatNumber(left)}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle cx="50" cy="50" r="46" className="countdown-track" />
        <circle cx="50" cy="50" r="46" className="countdown-ring" strokeDasharray={RING} />
      </svg>
      <span className="countdown-number">{formatNumber(left)}</span>
    </span>
  );
}
