import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import type { Team } from '../engine/types.ts';
import { TeamGlyph } from './TeamBadge.tsx';

type TileProps = {
  team: Team;
  /** What the team's colour holds besides its symbol, such as a player's number. */
  mark?: ReactNode;
  /** The colour sweeps across the whole tile: the team is chosen, or it is its turn. */
  filled?: boolean;
  /** The tile's height in pixels; the colour and its curve scale with it. */
  height?: number;
  className?: string;
  children?: ReactNode;
};

const classes = (...names: (string | undefined | false)[]) => names.filter(Boolean).join(' ');
const size = (height: number) => ({ '--tile-h': `${height}px` }) as CSSProperties;

function Inner({ team, mark, children }: Pick<TileProps, 'team' | 'mark' | 'children'>) {
  return (
    <>
      <span className="team-tile-paint" aria-hidden="true" />
      <span className="team-tile-mark">
        <TeamGlyph team={team} />
        {mark}
      </span>
      <span className="team-tile-body">{children}</span>
    </>
  );
}

/**
 * The one way the site shows a team: its colour fills the start of the tile, a quarter of it at least,
 * holds its symbol, and ends in a soft curve. Filled, the colour sweeps across the whole tile.
 */
export function TeamTile({ team, mark, filled, height = 52, className, children }: TileProps) {
  return (
    <div className={classes('team-tile', className)} data-team={team} data-filled={filled || undefined} style={size(height)}>
      <Inner team={team} mark={mark}>
        {children}
      </Inner>
    </div>
  );
}

/** A team's tile that can be pressed: pointing at it draws its colour a little further. */
export function TeamTileButton({
  team,
  mark,
  filled,
  height = 52,
  className,
  children,
  ...rest
}: TileProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      type="button"
      className={classes('team-tile', 'team-tile-button', className)}
      data-team={team}
      data-filled={filled || undefined}
      style={size(height)}
      {...rest}
    >
      <Inner team={team} mark={mark}>
        {children}
      </Inner>
    </button>
  );
}
