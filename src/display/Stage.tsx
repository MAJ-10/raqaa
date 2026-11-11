import { useEffect, useState, type ReactNode } from 'react';
import { unlockSound } from './sound.ts';

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;

/** How much the 1280×720 stage grows or shrinks to fit a window, keeping its proportions. */
function stageScale(width: number, height: number): number {
  return Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT);
}

/** The display's first click or key: fullscreen, and sound from then on. */
function enterFullscreen(): void {
  unlockSound();
  if (document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.().catch(() => {
    // The browser refused (for example without a user gesture); the stage still works in a window.
  });
}

/**
 * The display is drawn on a fixed 1280×720 stage, scaled to fit the screen, with the sky's colour around
 * it (the night's, in the announcement). The first click or key on the display makes it fullscreen and
 * lets it make sound.
 */
export function Stage({ night = false, children }: { night?: boolean; children: ReactNode }) {
  const [scale, setScale] = useState(() => stageScale(innerWidth, innerHeight));

  useEffect(() => {
    const update = () => setScale(stageScale(innerWidth, innerHeight));
    addEventListener('resize', update);
    addEventListener('keydown', enterFullscreen);
    return () => {
      removeEventListener('resize', update);
      removeEventListener('keydown', enterFullscreen);
    };
  }, []);

  return (
    <div className="stage-viewport" data-night={night || undefined} onPointerDown={enterFullscreen}>
      <div className="stage" data-testid="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
