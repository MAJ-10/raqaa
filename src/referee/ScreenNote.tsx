import { useEffect, useState, useSyncExternalStore } from 'react';
import { displayOpened, onDisplayOpened, screenExtended } from './open-display.ts';

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
 * Once the referee opens the display, a word in the bar while there is only one screen: a TV that
 * mirrors the laptop shows the referee's screen, so it has to be extended instead. It goes as soon as
 * the screen is extended.
 */
export function ScreenNote() {
  const opened = useSyncExternalStore(onDisplayOpened, displayOpened);
  const extended = useExtended();
  if (!opened || extended !== false) return null;
  return (
    <p className="note screen-note" role="status">
      لو التلفزيون يكرر شاشة اللابتوب: Win + P ثم «توسيع» (Extend)
    </p>
  );
}
