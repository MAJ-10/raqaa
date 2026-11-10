import logo from '../../assets/brand/logo-horizontal.svg';
import type { GameEvent, GameState } from '../engine/types.ts';
import { Cloud, Skyline } from '../ui/City.tsx';
import { Icon } from '../ui/Icon.tsx';
import './display.css';
import { GameWindow } from './GameWindow.tsx';
import { IsoMap } from './IsoMap.tsx';
import { Podium } from './Podium.tsx';
import { Stage } from './Stage.tsx';
import { TeamSigns } from './TeamSigns.tsx';
import { useClock } from './use-clock.ts';
import { useRefereeSnapshot } from './use-referee.ts';
import { announceStep, displayWindow, windowWake, type DisplayWindow } from './windows.ts';

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

/** The identity's sky behind everything: clouds by day; by night (the announcement) stars, and the city lit. */
function Scenery({ night }: { night: boolean }) {
  return (
    <div className="display-scenery" data-night={night || undefined} aria-hidden="true">
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
    </div>
  );
}

/** A new window comes in fresh; the same window keeps its place while it changes. */
const windowKey = (shown: DisplayWindow) =>
  shown.kind === 'card' ? `card-${shown.card}-${shown.team}-${shown.says}` : shown.kind === 'mission' ? `mission-${shown.team}-${shown.result.mission}` : shown.kind;

/**
 * The display: the identity's sky and city, the map in the middle and each team's boards at its corner,
 * with a window over the dimmed game when the moment calls for one: the numbers, the question, the answer,
 * an auction, a card, a mission. Before the competition starts, the logo sits on top and the map lower
 * (D01). The announcement happens at night, and ends on the podium (D21). It only shows: nothing here
 * changes the game.
 */
export function DisplayApp() {
  const snapshot = useRefereeSnapshot<GameState | null, GameEvent>();
  const state = snapshot?.state ?? null;
  // What shows depends on the last event in the log, not only on one just made: a display that reopens
  // shows the same thing.
  const last = snapshot?.latest ?? null;
  // The clock moves on after each event, so a window that goes by itself (a card, the end of an auction,
  // the permits) can go.
  const now = useClock(last ? windowWake(last) : null);
  const starting = state === null || state.step === 'setup';
  const night = state?.step === 'announce';
  const step = state ? announceStep(state) : null;
  const shown = state && !starting ? displayWindow(state, last, now) : null;

  if (state && step?.kind === 'podium') {
    return (
      <Stage night>
        <Scenery night />
        <Podium state={state} />
      </Stage>
    );
  }

  return (
    <Stage night={night}>
      <Scenery night={night} />
      {state ? (
        <div className="display-game" data-dimmed={shown ? '' : undefined}>
          <IsoMap state={state} night={night} className={starting ? 'display-map display-map-start' : 'display-map'} />
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
      {state && shown ? <GameWindow key={windowKey(shown)} state={state} shown={shown} /> : null}
    </Stage>
  );
}
