import type { Team } from '../engine/types.ts';
import { svgByName } from './svg.ts';

// Team symbols from assets/teams, drawn in ink on the team colour. A team colour never appears without its symbol.
const symbols = svgByName(
  import.meta.glob<string>('../../assets/teams/*.svg', { query: '?raw', import: 'default', eager: true }),
);

export function TeamSymbol({ team, size = 40 }: { team: Team; size?: number }) {
  return (
    <span
      className="team-symbol"
      data-team={team}
      style={{ width: size, height: size, padding: Math.round(size * 0.22) }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: symbols[team] ?? '' }}
    />
  );
}

/** The team's symbol and name. */
export function TeamBadge({ team, name, size }: { team: Team; name: string; size?: number }) {
  return (
    <span className="team-badge">
      <TeamSymbol team={team} size={size} />
      <span className="team-badge-name">{name}</span>
    </span>
  );
}
