import tokens from '../../assets/tokens.json';
import type { Team } from '../engine/types.ts';
import { iconInside } from './board-art.ts';

/**
 * The bidder's pin over a plot, inside an SVG: a stick up from the roof at (x, y) to a round badge in the
 * bidder's colour, holding the gavel in ink.
 */
export function Pin({ x, y, team, radius = 19, stick = 30 }: { x: number; y: number; team: Team; radius?: number; stick?: number }) {
  const colour = tokens.team[team].main;
  const cy = y - stick - radius;
  const k = (radius * 1.15) / 24;
  return (
    <g className="pin" data-team={team}>
      <line x1={x} y1={y} x2={x} y2={cy} stroke={colour} strokeWidth={4} strokeLinecap="round" />
      <circle cx={x} cy={cy} r={radius} fill={colour} />
      <g
        transform={`translate(${(x - 12 * k).toFixed(1)} ${(cy - 12 * k).toFixed(1)}) scale(${k.toFixed(3)})`}
        fill={tokens.color.ink}
        dangerouslySetInnerHTML={{ __html: iconInside('gavel') }}
      />
    </g>
  );
}
