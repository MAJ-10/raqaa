import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import logo from '../../assets/brand/logo-horizontal.svg';
import { timerSeconds } from '../engine/select.ts';
import type { GameEvent, GameState } from '../engine/types.ts';
import { Cloud, Skyline } from '../ui/City.tsx';
import { Icon } from '../ui/Icon.tsx';
import { EASE_OUT, motion, reducedMotion } from '../ui/motion.ts';
import { secondsLeft } from '../ui/time.ts';
import { cuesFor } from './cues.ts';
import './display.css';
import { GameWindow } from './GameWindow.tsx';
import { IsoMap } from './IsoMap.tsx';
import { Podium } from './Podium.tsx';
import { playSound, setSoundMuted } from './sound.ts';
import { Stage } from './Stage.tsx';
import { TeamSigns } from './TeamSigns.tsx';
import { useClock } from './use-clock.ts';
import { useRefereeSnapshot } from './use-referee.ts';
import { announceStep, displayWindow, nextWake, type DisplayWindow, type Running } from './windows.ts';

/** The clouds of the display's sky, where screen D01 has them: centre and size of each. */
const CLOUDS: [x: number, y: number, k: number][] = [
  [150, 250, 1.8],
  [1120, 300, 2.1],
  [330, 120, 1.1],
  [980, 150, 1.2],
  [1190, 560, 1],
  [90, 470, 1.24],
];

/** The night's stars, scattered the same way every time over the upper sky: x, y, radius, brightness. */
const STARS: [number, number, number, number][] = (() => {
  let seed = 8;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 80 }, () => [
    Math.round(random() * 1280),
    Math.round(random() * 440),
    [1.1, 1.5, 1.9][Math.floor(random() * 3)]!,
    [0.3, 0.5, 0.75][Math.floor(random() * 3)]!,
  ]);
})();

/** How long night takes to fall when the announcement starts. */
const DUSK = 1400;

/**
 * The identity's sky behind everything: clouds by day; by night (the announcement) stars, and the city
 * lit. When night has just fallen, the day's sky fades away and the city's windows light one by one.
 */
function Scenery({ night, dusk }: { night: boolean; dusk: boolean }) {
  const sky = useRef<HTMLDivElement>(null);
  const city = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!dusk) return;
    motion(sky.current, [{ opacity: 1 }, { opacity: 0 }], { duration: DUSK, fill: 'forwards' });
    city.current?.querySelectorAll('.display-skyline > g:last-child > rect').forEach((window, k) => {
      motion(window, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 500 + ((k * 37) % 23) * 60, fill: 'backwards' });
    });
  }, [dusk]);
  return (
    <div ref={city} className="display-scenery" data-night={night || undefined} aria-hidden="true">
      {night ? (
        <svg className="display-stars" viewBox="0 0 1280 720" focusable="false">
          {STARS.map(([x, y, r, o], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="var(--white)" opacity={o} />
          ))}
        </svg>
      ) : (
        CLOUDS.map(([x, y, k]) => (
          <Cloud key={x} className="display-cloud" style={{ left: x - 33 * k, top: y - 27 * k, width: 89 * k }} />
        ))
      )}
      <Skyline className="display-skyline" />
      {dusk && !reducedMotion() ? <div ref={sky} className="display-dusk" /> : null}
    </div>
  );
}

/** A new window comes in fresh; the same window keeps its place while it changes. */
const windowKey = (shown: DisplayWindow) =>
  shown.kind === 'card' ? `card-${shown.card}-${shown.team}-${shown.says}` : shown.kind === 'mission' ? `mission-${shown.team}-${shown.result.mission}` : shown.kind;

/**
 * A window coming in and going out: it rises softly into place when the moment brings it, and when it
 * goes, a copy of it fades where it stood. A display that reopens shows it at once.
 */
function WindowMotion({ live, children }: { live: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  // Whether it came with the moment, read only when it mounts.
  const came = useRef(live);
  useLayoutEffect(() => {
    const node = box.current;
    const stage = node?.parentElement ?? null;
    if (came.current) {
      motion(node, [{ opacity: 0, transform: 'translateY(14px) scale(0.97)' }, { opacity: 1, transform: 'none' }], { duration: 360 });
    }
    return () => {
      if (!node || !stage || reducedMotion()) return;
      const ghost = node.cloneNode(true) as HTMLElement;
      ghost.setAttribute('aria-hidden', 'true');
      ghost.querySelectorAll('[data-window]').forEach((element) => element.removeAttribute('data-window'));
      stage.appendChild(ghost);
      const fade = ghost.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(0.98)' }], { duration: 240, easing: EASE_OUT });
      fade.onfinish = () => ghost.remove();
    };
  }, []);
  return (
    <div ref={box} className="window-motion">
      {children}
    </div>
  );
}

/** The sounds of the moment that just happened, once, unless muted (see sound.ts). */
function useCues(state: GameState | null, fresh: GameEvent | null, muted: boolean): void {
  const played = useRef<string | null>(null);
  useEffect(() => setSoundMuted(muted), [muted]);
  useEffect(() => {
    if (!state || !fresh) return;
    const key = `${fresh.at}|${fresh.type}`;
    if (played.current === key) return;
    played.current = key;
    for (const cue of cuesFor(state, fresh)) playSound(cue.sound, cue.after);
  }, [state, fresh]);
}

/** A tick for each of the last five seconds of a running timer. */
function useTicks(timer: Running | null): void {
  const startedAt = timer?.startedAt;
  const seconds = timer?.seconds;
  useEffect(() => {
    if (startedAt === undefined || seconds === undefined) return;
    let shown = secondsLeft(startedAt, seconds, Date.now());
    const id = setInterval(() => {
      const left = secondsLeft(startedAt, seconds, Date.now());
      if (left === shown) return;
      shown = left;
      if (left >= 1 && left <= 5) playSound('tick');
    }, 100);
    return () => clearInterval(id);
  }, [startedAt, seconds]);
}

/**
 * The display: the identity's sky and city, the map in the middle and each team's boards at its corner,
 * with a window over the dimmed game when the moment calls for one: the numbers, the question, the answer,
 * an auction, a card, a mission. Before the competition starts, the logo sits on top and the map lower
 * (D01). The announcement happens at night, and ends on the podium (D21). Motion and sound follow only the
 * event that has just happened: a display that reopens draws the state as it is. It only shows: nothing
 * here changes the game.
 */
export function DisplayApp() {
  const snapshot = useRefereeSnapshot<GameState | null, GameEvent>();
  const state = snapshot?.state ?? null;
  // What shows depends on the last event in the log, not only on one just made: a display that reopens
  // shows the same thing.
  const last = snapshot?.latest ?? null;
  // The event that has just happened, for motion and sound; none when the display reopens or after undo.
  const fresh = snapshot?.last ?? null;
  // The clock moves on after each event, so a window that goes by itself (a card, the end of an auction,
  // the permits) can go.
  const now = useClock((t) => nextWake(last, t));
  const starting = state === null || state.step === 'setup';
  const night = state?.step === 'announce';
  const step = state ? announceStep(state) : null;
  const shown = state && !starting ? displayWindow(state, last, now) : null;
  const seconds = state ? timerSeconds(state) : null;
  const running = state?.timer && seconds ? { startedAt: state.timer.startedAt, seconds } : null;

  useCues(state, fresh, snapshot?.muted ?? false);
  useTicks(running);

  if (state && step?.kind === 'podium') {
    return (
      <Stage night>
        <Scenery night dusk={false} />
        <Podium state={state} live={fresh?.type === 'announce/next'} />
      </Stage>
    );
  }

  return (
    <Stage night={night}>
      <Scenery night={night} dusk={fresh?.type === 'game/end'} />
      {state ? (
        <div className="display-game" data-dimmed={shown ? '' : undefined}>
          <IsoMap
            state={state}
            night={night}
            fresh={fresh}
            className={starting ? 'display-map display-map-start' : 'display-map'}
          />
          <TeamSigns state={state} shown={shown} />
        </div>
      ) : null}
      {starting ? <img className="display-logo" src={logo} alt="رقعة" /> : null}
      {step?.kind === 'population' ? (
        <p className="display-title">
          <Icon name="house" size={30} />
          سكان الخريطة
        </p>
      ) : null}
      {state && shown ? (
        <WindowMotion key={windowKey(shown)} live={fresh !== null}>
          <GameWindow state={state} shown={shown} live={fresh !== null} />
        </WindowMotion>
      ) : null}
    </Stage>
  );
}
