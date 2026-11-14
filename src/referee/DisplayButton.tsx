import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '../ui/Button.tsx';
import { dismissScreenNote, onScreenNote, openDisplayWindow, screenExtended, screenNoteDue } from './open-display.ts';

/** Whether the laptop's screen is extended, following the change when a TV is plugged in or set up. */
function useExtended(): boolean | undefined {
  const [extended, setExtended] = useState(screenExtended);
  useEffect(() => {
    const update = () => setExtended(screenExtended());
    // Chrome and Edge tell the page when the screens change; the types here don't know it yet.
    const target = screen as unknown as Partial<EventTarget>;
    target.addEventListener?.('change', update);
    return () => target.removeEventListener?.('change', update);
  }, []);
  return extended;
}

/**
 * «شاشة العرض» in the bar's tools. Once the referee opens the display while the laptop has one screen, a
 * small card under the button says what to do if the TV shows the laptop's screen. It goes when the
 * referee closes it, when play goes on (`progress` changes), or as soon as the screen is extended.
 */
export function DisplayButton({ progress }: { progress?: number }) {
  const due = useSyncExternalStore(onScreenNote, screenNoteDue);
  const extended = useExtended();
  const shown = due && extended === false;

  // Play going on, after the card came, takes it away.
  const since = useRef(progress);
  useEffect(() => {
    if (!due) since.current = progress;
    else if (progress !== since.current) dismissScreenNote();
  }, [due, progress]);

  return (
    <span className="display-anchor">
      <Button variant="quiet" icon="tv" aria-label="فتح شاشة العرض" onClick={openDisplayWindow}>
        شاشة العرض
      </Button>
      {shown ? (
        <div className="screen-tip" role="status">
          <strong>التلفزيون يعرض شاشة اللابتوب؟</strong>
          <p>
            اضغط <kbd>Win + P</kbd> واختر «توسيع» (Extend)، فتنتقل شاشة العرض إلى التلفزيون.
          </p>
          <Button variant="quiet" icon="x" aria-label="إغلاق" onClick={dismissScreenNote} />
        </div>
      ) : null}
    </span>
  );
}
