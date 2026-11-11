import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import tokens from '../../assets/tokens.json';
import { getBoard } from '../engine/board.ts';
import { teamInTurn } from '../engine/select.ts';
import type { GameEvent, GameState, PlotId } from '../engine/types.ts';
import { iconSvg } from '../ui/icons.ts';
import { EASE_BOUNCE, motion, reducedMotion } from '../ui/motion.ts';
import { formatNumber } from '../ui/number.ts';
import { TEAM_PATHS } from '../ui/team-paths.ts';
import { boardLooks, iconInside, landing, plateShape, plotShape, struckPlan, tones, type PlotLook } from './board-art.ts';
import { bounds, isoUnit, MAP_STEP, MAP_VIEW, project, type BoxShape, type Palette } from './iso.ts';
import { Pin } from './Pin.tsx';
import { JUMP_DRAW } from './windows.ts';

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

type Props = { state: GameState; night?: boolean; fresh?: GameEvent | null; className?: string };

/**
 * The display's iso map, drawn from the state: the plate, each plot as a rounded tile, buildings that
 * rise with the plot's value in the team's colours with its symbol on the roof, the cards lying on the
 * plots no one has built yet, and the tower flat until a team takes it. While a team plays, the other
 * teams' buildings sink and the plots it can act on stand up, edged and numbered. Night colours for the
 * announcement. The moment that has just happened (`fresh`) moves: a plot a team gains drops into place
 * with a ring and its population in a bubble; a bridge's line jumps to it first; a pin drops on a plot
 * bid for; a plan that strikes stamps itself on its roof.
 */
export function IsoMap({ state, night = false, fresh = null, className }: Props) {
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
  const svg = useRef<SVGSVGElement>(null);

  // What the moment just did on the map: drawn for its motion only.
  const landed = fresh && !reducedMotion() ? landing(state, fresh) : null;
  const landedLook = landed ? looks.find((l) => l.id === landed.plot) : undefined;
  const fromLook = landed?.from ? looks.find((l) => l.id === landed.from) : undefined;
  const top = (look: PlotLook) => project(look.i + 0.5, look.j + 0.5, heights[look.id] ?? look.height, s, n, MAP_VIEW);

  const animated = useRef<string | null>(null);
  const turn = useRef<string | null>(inTurn);
  useLayoutEffect(() => {
    const root = svg.current;
    const before = turn.current;
    turn.current = inTurn;
    if (!root || !fresh) return;
    const key = `${fresh.at}|${fresh.type}`;
    if (animated.current === key) return;
    animated.current = key;

    const land = landing(state, fresh);
    if (land) {
      // With the bridge, its line draws first, and the building lands where it arrives.
      const wait = land.from ? JUMP_DRAW : 0;
      if (land.from) {
        const line = root.querySelector('.bridge-jump');
        motion(line, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: JUMP_DRAW, easing: 'ease-in-out', fill: 'both' });
        motion(line, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 1800, fill: 'forwards' });
      }
      motion(
        root.querySelector(`[data-plot="${land.plot}"]`),
        [
          { transform: 'translateY(-34px)', opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 520, delay: wait, easing: EASE_BOUNCE, fill: 'backwards' },
      );
      motion(
        root.querySelector('.land-ring'),
        [
          { opacity: 0.9, transform: 'scale(1)' },
          { opacity: 0, transform: 'scale(1.7)' },
        ],
        { duration: 720, delay: wait + 260, fill: 'forwards' },
      );
      motion(
        root.querySelector('.gain-bubble'),
        [
          { opacity: 0, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'translateY(-10px)', offset: 0.2 },
          { opacity: 1, transform: 'translateY(-20px)', offset: 0.8 },
          { opacity: 0, transform: 'translateY(-28px)' },
        ],
        { duration: 1800, delay: wait + 220, fill: 'both' },
      );
    }
    if (fresh.type === 'auction/declare') {
      motion(
        root.querySelector(`[data-pin="${fresh.plot}"]`),
        [
          { transform: 'translateY(-44px)', opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 560, easing: EASE_BOUNCE },
      );
    }
    const struck = struckPlan(state, fresh);
    if (struck) {
      motion(
        root.querySelector(`[data-plot="${struck}"] [data-plan]`),
        [
          { transform: 'scale(2.4)', opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 520, delay: 300, easing: EASE_BOUNCE, fill: 'backwards' },
      );
    }
    // A new team's turn: its numbers come once its plots have risen.
    if (inTurn && inTurn !== before) {
      root.querySelectorAll('.map-number').forEach((number) => {
        motion(number, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 520, fill: 'backwards' });
      });
    }
  }, [fresh, state, inTurn]);

  return (
    <svg
      ref={svg}
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
                // A building to bid for takes the edge in ink, as anything on a team's colour.
                stroke={look.symbol ? ink : tokens.team[look.open!].side}
                strokeWidth={3}
                strokeDasharray="7 6"
                strokeLinecap="round"
              />
            ) : null}
            {drawn.symbol ? (
              <path d={TEAM_PATHS[look.symbol!]} transform={drawn.symbol} fill={ink} opacity={look.faded ? 0.5 : 1} />
            ) : null}
            {drawn.plan ? (
              // The outer group is what moves; the inner one lays the icon on the roof.
              <g data-plan="" className="map-stamp">
                <g transform={drawn.plan} fill={ink} opacity={look.faded ? 0.5 : 1} dangerouslySetInnerHTML={{ __html: iconInside('plan') }} />
              </g>
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
      {landed && landedLook && fromLook ? (
        // The bridge's line, jumping from the team's plot to the one it reached.
        <BridgeLine from={top(fromLook)} to={top(landedLook)} lift={s * 1.1} colour={tokens.team[landed.team].side} />
      ) : null}
      {landed && landedLook ? (
        <>
          <path
            className="land-ring"
            d={plotShape(landedLook, heights[landedLook.id] ?? landedLook.height, s, n).shape.top}
            fill="none"
            stroke={tokens.team[landed.team].main}
            strokeWidth={3}
            opacity={0}
          />
          <GainBubble at={top(landedLook)} gain={landed.gain} lift={s * 0.55} />
        </>
      ) : null}
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
        const [x, y] = top(look);
        return (
          <g key={auction.id} data-pin={auction.plot}>
            <Pin x={x} y={y} team={auction.bidder} />
          </g>
        );
      })}
    </svg>
  );
}

/** The bridge's line: solid, arching from one plot's top to the other's. It draws itself from the first. */
function BridgeLine({ from, to, lift, colour }: { from: [number, number]; to: [number, number]; lift: number; colour: string }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const peak = Math.min(y1, y2) - lift;
  return (
    <path
      className="bridge-jump"
      d={`M${x1.toFixed(1)} ${y1.toFixed(1)}Q${((x1 + x2) / 2).toFixed(1)} ${peak.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`}
      pathLength={1}
      strokeDasharray="1 1"
      strokeDashoffset={1}
      fill="none"
      stroke={colour}
      strokeWidth={4}
      strokeLinecap="round"
    />
  );
}

const HOUSE = iconSvg('house')?.match(/ d="([^"]+)"/)?.[1] ?? '';

/** The population a plot brought, in the identity's bubble, rising from it and fading. */
function GainBubble({ at, gain, lift }: { at: [number, number]; gain: number; lift: number }) {
  const [x, y] = at;
  const text = formatNumber(gain, { sign: true });
  const width = 30 + text.length * 11;
  return (
    <g className="gain-bubble" opacity={0}>
      <rect x={x - width / 2} y={y - lift - 16} width={width} height={32} rx={16} fill={tokens.color.white} />
      <path d={HOUSE} transform={`translate(${(x + width / 2 - 26).toFixed(1)} ${(y - lift - 8).toFixed(1)}) scale(0.67)`} fill={tokens.color.inkSoft} />
      <text className="gain-text" x={x - 8} y={y - lift} fill={tokens.color.ink}>
        {text}
      </text>
    </g>
  );
}
