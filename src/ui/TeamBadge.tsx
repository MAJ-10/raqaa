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

/** The symbol alone, in ink, sized by CSS: for a plot that already carries the team's colour. */
export function TeamGlyph({ team }: { team: Team }) {
  return <span className="team-glyph" aria-hidden="true" dangerouslySetInnerHTML={{ __html: symbols[team] ?? '' }} />;
}

/** A team's name inside a sentence, on its colour with its symbol. */
export function TeamName({ team, name }: { team: Team; name: string }) {
  return (
    <span className="team-name" data-team={team}>
      <TeamGlyph team={team} />
      {name}
    </span>
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
