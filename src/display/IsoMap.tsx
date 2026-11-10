import { useEffect, useMemo, useRef, useState } from 'react';
import tokens from '../../assets/tokens.json';
import { getBoard } from '../engine/board.ts';
import { teamInTurn } from '../engine/select.ts';
import type { GameState, PlotId } from '../engine/types.ts';
import { reducedMotion } from '../ui/motion.ts';
import { formatNumber } from '../ui/number.ts';
import { TEAM_PATHS } from '../ui/team-paths.ts';
import { boardLooks, iconInside, plateShape, plotShape, tones, type PlotLook } from './board-art.ts';
import { bounds, isoUnit, MAP_STEP, MAP_VIEW, project, type BoxShape, type Palette } from './iso.ts';
import { Pin } from './Pin.tsx';

/** How far toward a plot's back corner, in plan, its number sits: above the card in the middle. */
const NUMBER_BACK = 0.3;

/** How long a plot takes to rise or sink, and how much later each row from the back starts. */
const DURATION = 620;
const WAVE = 24;

/** Rising overshoots a little and settles; sinking just eases down. */
const rise = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
const sink = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * The plots' heights, moving to their new heights whenever the map changes: a wave from the back of the
 * board to the front. Under reduced motion they simply take their new heights.
 */
function useMovingHeights(looks: PlotLook[]): Record<PlotId, number> {
  const targets = useMemo(() => Object.fromEntries(looks.map((l) => [l.id, l.height])) as Record<PlotId, number>, [looks]);
  const [heights, setHeights] = useState(targets);
  const now = useRef(targets);
  const still = reducedMotion();

  useEffect(() => {
    const from = now.current;
    if (still) {
      now.current = targets;
      return;
    }
    const began = performance.now();
    const order = Object.fromEntries(looks.map((l) => [l.id, l.order]));
    let frame = requestAnimationFrame(function tick(time) {
      let moving = false;
      const next: Record<PlotId, number> = {};
      for (const [id, to] of Object.entries(targets)) {
        const start = from[id] ?? to;
        if (start === to) {
          next[id] = to;
          continue;
        }
        const t = Math.min(1, Math.max(0, (time - began - (order[id] ?? 0) * WAVE) / DURATION));
        if (t < 1) moving = true;
        next[id] = start + (to - start) * (to > start ? rise(t) : sink(t));
      }
      now.current = next;
      setHeights(next);
      if (moving) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [targets, looks, still]);

  return still ? targets : heights;
}

/** A box drawn from its shape: the two faces, then the top. */
export function Box({ shape, palette }: { shape: BoxShape; palette: Palette }) {
  return (
    <>
      {shape.left ? <path d={shape.left} fill={palette[1]} /> : null}
      {shape.right ? <path d={shape.right} fill={palette[2]} /> : null}
      <path d={shape.top} fill={palette[0]} />
    </>
  );
}

/**
 * The display's iso map, drawn from the state: the plate, each plot as a rounded tile, buildings that
 * rise with the plot's value in the team's colours with its symbol on the roof, the cards lying on the
 * plots no one has built yet, and the tower flat until a team takes it. While a team plays, the other
 * teams' buildings sink and the plots it can build on rise, edged in its colour. Night colours for the
 * announcement.
 */
export function IsoMap({ state, night = false, className }: { state: GameState; night?: boolean; className?: string }) {
  const pal = night ? tokens.map.night : tokens.map.day;
  const n = getBoard(state.setup.size).size;
  const s = isoUnit(n);
  const looks = useMemo(() => boardLooks(state, night), [state, night]);
  const heights = useMovingHeights(looks);
  const plate = useMemo(() => plateShape(s, n), [s, n]);
  const view = bounds(s, n, MAP_VIEW, MAP_STEP);
  const ink = tokens.color.ink;
  // Today's auctions not played yet: each plot carries its bidder's pin.
  const pins = state.auctions.filter((a) => a.day === state.day && (a.status === 'declared' || a.status === 'open'));
  const inTurn = teamInTurn(state);
  const numberColour = inTurn ? tokens.team[inTurn].side : ink;

  return (
    <svg
      className={className}
      viewBox={`${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.width.toFixed(1)} ${view.height.toFixed(1)}`}
      aria-hidden="true"
      focusable="false"
    >
      <Box shape={plate} palette={tones(pal.plate)} />
      {looks.map((look) => {
        const drawn = plotShape(look, heights[look.id] ?? look.height, s, n);
        return (
          <g key={look.id} data-plot={look.id} data-team={look.symbol} data-open={look.open ? '' : undefined}>
            <Box shape={drawn.shape} palette={look.palette} />
            {drawn.edge ? (
              <path
                d={drawn.edge}
                fill="none"
                stroke={tokens.team[look.open!].side}
                strokeWidth={3}
                strokeDasharray="7 6"
                strokeLinecap="round"
              />
            ) : null}
            {drawn.symbol && look.plan ? (
              <g
                transform={drawn.symbol}
                fill={ink}
                opacity={look.faded ? 0.5 : 1}
                data-plan=""
                dangerouslySetInnerHTML={{ __html: iconInside('plan') }}
              />
            ) : drawn.symbol ? (
              <path d={TEAM_PATHS[look.symbol!]} transform={drawn.symbol} fill={ink} opacity={look.faded ? 0.5 : 1} />
            ) : null}
            {drawn.card ? (
              <g
                transform={drawn.card}
                fill="currentColor"
                style={{ color: pal.card_ink }}
                dangerouslySetInnerHTML={{ __html: iconInside(look.card!) }}
              />
            ) : null}
          </g>
        );
      })}
      {looks.map((look) => {
        if (!look.number) return null;
        // The number the leader calls out, in the top of its own plot, between the back corner and the card,
        // so the card keeps its place. In the darker tone of the team in turn, like the dashed edge of its
        // plots, which its white outline cuts cleanly.
        const [x, y] = project(look.i + 0.5 - NUMBER_BACK, look.j + 0.5 - NUMBER_BACK, heights[look.id] ?? look.height, s, n, MAP_VIEW);
        return (
          <text
            key={`number-${look.id}`}
            className="map-number"
            data-number={look.number}
            x={x}
            y={y}
            fill={numberColour}
            style={{ fontSize: s * 0.29, strokeWidth: s * 0.07 }}
          >
            {formatNumber(look.number)}
          </text>
        );
      })}
      {pins.map((auction) => {
        const look = looks.find((l) => l.id === auction.plot);
        if (!look) return null;
        const [x, y] = project(look.i + 0.5, look.j + 0.5, heights[look.id] ?? look.height, s, n, MAP_VIEW);
        return <Pin key={auction.id} x={x} y={y} team={auction.bidder} />;
      })}
    </svg>
  );
}
