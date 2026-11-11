import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import tokens from '../../assets/tokens.json';
import mark from '../../assets/brand/mark.svg';
import { ranking } from '../engine/missions.ts';
import type { GameState, Team } from '../engine/types.ts';
import { Icon } from '../ui/Icon.tsx';
import { EASE_BOUNCE, motion, reducedMotion } from '../ui/motion.ts';
import { formatNumber } from '../ui/number.ts';
import { TeamTile } from '../ui/TeamTile.tsx';
import { TEAM_PATHS } from '../ui/team-paths.ts';
import { box, decal, path, project, REFERENCE_VIEW, type BoxShape } from './iso.ts';
import { Box } from './IsoMap.tsx';
import { playSound } from './sound.ts';
import { TileFrame } from './TileFrame.tsx';

// The final podium (D21), as reference/iso-board.md and model_a in reference/mayor.py draw it: four
// towers of floors in the teams' colours, first on the right, on the identity's 35° camera.

const S = 56;
const FOOT = 1.9;
const FLOOR = 0.78;
const RADIUS = 0.16;
const SEAM = 0.08;
const TILE_MARGIN = 0.34;
const TILE_DEPTH = 0.24;
/** Floors by rank: the first tower is the tallest. Teams that share a rank share a height. */
const FLOORS = [8, 6, 4, 2] as const;
/** Screen distance between two towers, and where the row stands on the stage. */
const SPACING = 290;
const ORIGIN_X = 640;
const ORIGIN_Y = 548;

/** The towers rise one after another, from the fourth to the first; then the crown lands. */
const FIRST_RISE = 500;
const NEXT_RISE = 650;
const RISE = 850;
const COUNT = 900;

const CO = Math.SQRT1_2;
const D = SPACING / (2 * CO * S);

/** A point on the podium's ground plan, to the stage. */
const at = (i: number, j: number, z: number) => {
  const [x, y] = project(i, j, z, S, 0, REFERENCE_VIEW);
  return [ORIGIN_X + x, ORIGIN_Y + y] as const;
};

/** A tower's box, drawn around the podium's origin (the SVG group moves it into place). */
const shape = (plan: [number, number, number, number], z0: number, z1: number, r: number): BoxShape =>
  box(plan, z0, z1, r, S, 0, REFERENCE_VIEW);

/** A point on a wall, around the podium's origin. */
const wall = (i: number, j: number, z: number) => project(i, j, z, S, 0, REFERENCE_VIEW);

type Tower = { team: Team; rank: number; population: number; floors: number; ci: number; cj: number };

function towers(state: GameState): Tower[] {
  return ranking(state).map((row, place) => {
    const k = 3 - place; // the first stands on the right
    return {
      team: row.team,
      rank: row.rank,
      population: row.score * 100,
      floors: FLOORS[Math.min(row.rank, 4) - 1]!,
      ci: (k - 1.5) * D,
      cj: -(k - 1.5) * D,
    };
  });
}

/** When a tower starts to rise: the last place first. `place` counts from 0 for the first. */
const riseAt = (place: number, count: number) => FIRST_RISE + (count - 1 - place) * NEXT_RISE;

function TowerDrawing({ tower }: { tower: Tower }) {
  const { ci, cj, team, floors } = tower;
  const t = tokens.team[team];
  const palette = [t.main, t.side, t.side2] as const;
  const [x0, y0, x1, y1] = [ci - FOOT / 2, cj - FOOT / 2, ci + FOOT / 2, cj + FOOT / 2];
  const m = TILE_MARGIN;
  const parts = [];
  for (let f = 0; f < floors; f++) {
    const z = f * FLOOR;
    const top = z + FLOOR;
    parts.push(<Box key={`f${f}`} shape={shape([x0, y0, x1, y1], z, top - SEAM, RADIUS)} palette={palette} />);
    for (const c of [-0.42, 0.42]) {
      const [w0, w1] = [z + 0.2 * FLOOR, z + 0.66 * FLOOR];
      parts.push(
        <path key={`l${f}${c}`} d={path([wall(ci + c - 0.2, y1, w0), wall(ci + c + 0.2, y1, w0), wall(ci + c + 0.2, y1, w1), wall(ci + c - 0.2, y1, w1)])} fill={tokens.color.litWindow} />,
        <path key={`r${f}${c}`} d={path([wall(x1, cj + c - 0.2, w0), wall(x1, cj + c + 0.2, w0), wall(x1, cj + c + 0.2, w1), wall(x1, cj + c - 0.2, w1)])} fill={tokens.color.litWindowShade} />,
      );
    }
    if (f < floors - 1) {
      // The recessed seam between two floors, in the side colour darkened toward ink.
      const seam = shape([x0 + 0.07, y0 + 0.07, x1 - 0.07, y1 - 0.07], top - SEAM, top, RADIUS);
      parts.push(
        <g key={`s${f}`}>
          <path d={seam.left} fill={t.side2} />
          <path d={seam.right} fill={t.side2} />
          <path d={`${seam.left}${seam.right}`} fill={tokens.color.ink} opacity={0.4} />
        </g>,
      );
    }
  }
  const roof = floors * FLOOR - SEAM;
  if (tower.rank !== 1) {
    parts.push(<path key="symbol" d={TEAM_PATHS[team]} transform={decal(ci, cj, roof, 1, S, 0, REFERENCE_VIEW)} fill={tokens.color.ink} />);
  }
  return (
    <g data-tower={team}>
      <Box shape={shape([x0 - m, y0 - m, x1 + m, y1 + m], -TILE_DEPTH, 0, RADIUS + 0.12)} palette={tokens.map.night.v2 as unknown as readonly [string, string, string]} />
      {/* The floors are what rise, from the tile up. */}
      <g className="tower-body" data-rise={team}>
        {parts}
      </g>
    </g>
  );
}

/** Where a tower's labels go on the stage: the bubble over the roof, the crown on it, the plate under it. */
function labels(tower: Tower) {
  const roof = tower.floors * FLOOR - SEAM;
  const [cx, cy] = at(tower.ci, tower.cj, roof);
  const back = at(tower.ci - FOOT / 2, tower.cj - FOOT / 2, roof)[1];
  const m = TILE_MARGIN;
  const base = at(tower.ci + FOOT / 2 + m, tower.cj + FOOT / 2 + m, -TILE_DEPTH)[1];
  const crown = cy - 62;
  return { x: cx, bubble: tower.rank === 1 ? crown - 4 : back - 14, crown, plate: base + 16 };
}

/** A population counting up from nothing once its tower stands, or shown at once. */
function CountFrom({ value, delay, live }: { value: number; delay: number; live: boolean }) {
  const counting = live && !reducedMotion();
  const [shown, setShown] = useState(counting ? 0 : value);
  useEffect(() => {
    if (!counting) return;
    let frame = 0;
    const start = setTimeout(() => {
      const began = performance.now();
      frame = requestAnimationFrame(function tick(now) {
        const t = Math.min(1, (now - began) / COUNT);
        setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
        if (t < 1) frame = requestAnimationFrame(tick);
      });
    }, delay);
    return () => {
      clearTimeout(start);
      cancelAnimationFrame(frame);
    };
  }, [counting, value, delay]);
  return <>{formatNumber(counting ? shown : value)}</>;
}

/**
 * D21, «عمدة الرقعة»: the four towers by rank, the tallest first on the right, each with its population
 * above it and its team's plate and rank under it, the crown on the first. Night, stars and the lit city,
 * with a soft gold glow behind the winner. When it has just come (`live`), the towers rise from the fourth
 * to the first, each landing with a thud, the numbers count up, and the crown lands last with a sparkle.
 */
export function Podium({ state, live }: { state: GameState; live: boolean }) {
  const rows = towers(state);
  const first = rows.find((row) => row.rank === 1)!;
  const glow = labels(first);
  const root = useRef<HTMLDivElement>(null);
  const came = useRef(live);
  const played = useRef(false);

  // Once, when the podium comes: the towers don't change after that.
  useLayoutEffect(() => {
    const node = root.current;
    if (played.current || !came.current || !node || reducedMotion()) return;
    played.current = true;
    const order = towers(state);
    const crownAt = riseAt(0, order.length) + RISE + 350;
    order.forEach((tower, place) => {
      const delay = riseAt(place, order.length);
      const label = (name: string) => node.querySelector(`[data-label="${tower.team}"] .${name}`);
      motion(node.querySelector(`[data-rise="${tower.team}"]`), [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: RISE, delay, fill: 'backwards' });
      motion(label('podium-plate'), [{ opacity: 0, transform: 'translate(-50%, 18px)' }, { opacity: 1, transform: 'translateX(-50%)' }], { duration: 420, delay, fill: 'backwards' });
      motion(label('podium-bubble'), [{ opacity: 0, transform: 'translate(-50%, -70%)' }, { opacity: 1, transform: 'translate(-50%, -100%)' }], { duration: 380, delay: delay + RISE - 120, fill: 'backwards' });
      playSound('thud', (delay + RISE - 60) / 1000);
    });
    node.querySelectorAll('.podium-crown').forEach((crown) => {
      motion(crown, [{ opacity: 0, transform: 'translate(-50%, -150px) rotate(-14deg)' }, { opacity: 1, transform: 'translateX(-50%)' }], { duration: 720, delay: crownAt, easing: EASE_BOUNCE, fill: 'backwards' });
    });
    motion(node.querySelector('.podium-glow'), [{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: crownAt, fill: 'backwards' });
    playSound('sparkle', (crownAt + 420) / 1000);
  }, [state]);

  return (
    <div ref={root} className="podium" data-testid="podium">
      <svg className="podium-art" viewBox="0 0 1280 720" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="podium-glow">
            <stop offset="0" stopColor={tokens.color.crown} stopOpacity="0.22" />
            <stop offset="1" stopColor={tokens.color.crown} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="podium-glow" cx={glow.x} cy={glow.crown + 230} r={330} fill="url(#podium-glow)" />
        <g transform={`translate(${ORIGIN_X} ${ORIGIN_Y})`}>
          {[...rows].reverse().map((tower) => (
            <TowerDrawing key={tower.team} tower={tower} />
          ))}
        </g>
      </svg>
      <h1 className="podium-title">
        <img src={mark} alt="" />
        عمدة الرقعة
      </h1>
      {rows.map((tower, place) => {
        const spot = labels(tower);
        return (
          <div key={tower.team} className="podium-labels" data-label={tower.team}>
            <span className="podium-bubble" style={{ left: spot.x, top: spot.bubble }}>
              <Icon name="house" size={24} />
              <CountFrom value={tower.population} delay={riseAt(place, rows.length) + RISE - 100} live={live} />
            </span>
            {tower.rank === 1 ? (
              <span className="podium-crown" style={{ left: spot.x, top: spot.crown }}>
                <Icon name="crown" size={70} />
              </span>
            ) : null}
            <div className="podium-plate" style={{ left: spot.x, top: spot.plate }}>
              <TeamTile team={tower.team} height={58} filled>
                <span className="team-tile-name">{state.setup.teams[tower.team].name}</span>
                <TileFrame />
              </TeamTile>
              <span className="podium-rank">{formatNumber(tower.rank)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
