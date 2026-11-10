import type { CSSProperties } from 'react';
import type { Team } from '../engine/types.ts';
import { TEAM_PATHS } from './team-paths.ts';

// The identity's signature: the teams' tiles come in from the four corners of the page and head for the
// middle, each colour with its symbol, with a few empty tiles at their edge. For opening pages only.

/** Each team's corner, as on the display and the cover of the identity guide. */
const CORNERS: { team: Team; at: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' }[] = [
  { team: 'coral', at: 'top-right' },
  { team: 'blue', at: 'top-left' },
  { team: 'green', at: 'bottom-right' },
  { team: 'gold', at: 'bottom-left' },
];

const ROWS = 6;
const TILE = 52;
const STEP = 66;

/** A staircase of team tiles from the corner, then one or two empty tiles where the colour stops. */
function tilesOf(): { row: number; col: number; team: boolean }[] {
  const tiles = [];
  for (let row = 0; row < ROWS; row++) {
    const coloured = ROWS - row;
    for (let col = 0; col < coloured; col++) tiles.push({ row, col, team: true });
    for (let col = coloured; col < coloured + 1 + (row % 2); col++) tiles.push({ row, col, team: false });
  }
  return tiles;
}

const TILES = tilesOf();

/** The four corners of tiles, behind the page's content. */
export function CornerTiles() {
  return (
    <div className="corner-tiles" aria-hidden="true">
      {CORNERS.map(({ team, at }) => (
        <svg key={team} className="corner" data-at={at} viewBox={`0 0 ${STEP * 8} ${STEP * ROWS}`} focusable="false">
          {TILES.map(({ row, col, team: coloured }) => (
            <g key={`${row}-${col}`} transform={`translate(${col * STEP} ${row * STEP})`}>
              {/* The tiles pop in one after the other, from the corner towards the middle. */}
              <g className="corner-tile" style={{ '--i': row + col } as CSSProperties}>
                <rect width={TILE} height={TILE} rx={12} fill={coloured ? `var(--${team})` : 'var(--white)'} />
                {coloured ? (
                  <path
                    d={TEAM_PATHS[team]}
                    fill="var(--ink)"
                    transform={`translate(${TILE * 0.29} ${TILE * 0.29}) scale(${(TILE * 0.42) / 24})`}
                  />
                ) : null}
              </g>
            </g>
          ))}
        </svg>
      ))}
    </div>
  );
}
