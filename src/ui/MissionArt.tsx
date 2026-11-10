import { TEAMS, type Mission, type Team } from '../engine/types.ts';
import { Icon } from './Icon.tsx';
import { TeamSymbol } from './TeamBadge.tsx';

/** Whose plot a cell of a mission's picture shows: the team's own, the tower, or one of the others. */
type Role = 'own' | 'tower' | 0 | 1 | 2;

/**
 * The pictures of the secret missions, exactly as the requirements draw them: map missions on a 7×7
 * map ([row, column, role]), log missions as an icon.
 */
const MAPS: Partial<Record<Mission, [number, number, Role][]>> = {
  innerStreet: [
    [2, 1, 'own'],
    [2, 2, 'own'],
    [2, 3, 'own'],
    [2, 4, 'own'],
  ],
  block: [
    [1, 1, 'own'],
    [1, 2, 'own'],
    [2, 1, 'own'],
    [2, 2, 'own'],
  ],
  everyRing: [
    [0, 1, 'own'],
    [1, 2, 'own'],
    [2, 2, 'own'],
    [3, 3, 'tower'],
  ],
  tower: [[3, 3, 'own']],
  heart: [
    [2, 2, 'own'],
    [2, 3, 'own'],
    [2, 4, 'own'],
    [3, 3, 'tower'],
  ],
  neighbourOfAll: [
    [1, 2, 0],
    [1, 3, 0],
    [2, 2, 'own'],
    [2, 3, 'own'],
    [3, 2, 'own'],
    [3, 1, 1],
    [4, 2, 2],
    [4, 3, 2],
  ],
};

const ICONS: Partial<Record<Mission, string>> = { collector: 'crane', successfulBidder: 'gavel' };

const SIZE = 7;
const CELL = 8;
const STEP = 10;

/** A mission's picture, in the colours of the team that holds it. CSS gives it its size. */
export function MissionArt({ mission, team }: { mission: Mission; team: Team }) {
  const others = TEAMS.filter((t) => t !== team);
  const cells = MAPS[mission];

  if (!cells) {
    return (
      <span className="mission-art" data-kind="icon" aria-hidden="true">
        {mission === 'twoTeams' ? (
          <span className="mission-art-teams">
            <TeamSymbol team={others[0]!} size={22} />
            <TeamSymbol team={others[1]!} size={22} />
          </span>
        ) : (
          <Icon name={ICONS[mission] ?? 'flag'} size={null} />
        )}
      </span>
    );
  }

  const fill = new Map(cells.map(([row, col, role]) => [`${row}-${col}`, role]));
  const colour = (role: Role | undefined) =>
    role === undefined
      ? 'var(--plot-3)'
      : role === 'own'
        ? `var(--${team})`
        : role === 'tower'
          ? 'var(--tower)'
          : `var(--${others[role]})`;

  return (
    <span className="mission-art" data-kind="map" aria-hidden="true">
      <svg viewBox={`0 0 ${SIZE * STEP - 2} ${SIZE * STEP - 2}`}>
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const row = Math.floor(i / SIZE);
          const col = i % SIZE;
          return (
            <rect
              key={i}
              x={col * STEP}
              y={row * STEP}
              width={CELL}
              height={CELL}
              rx={3}
              fill={colour(fill.get(`${row}-${col}`))}
            />
          );
        })}
      </svg>
    </span>
  );
}
