// What the display's iso map shows, worked out from the state: pure data for IsoMap to draw.
import tokens from '../../assets/tokens.json';
import { bridgeReach, getBoard } from '../engine/board.ts';
import { teamInTurn } from '../engine/select.ts';
import type { Card, GameEvent, GameState, PlotId, Team } from '../engine/types.ts';
import { iconSvg } from '../ui/icons.ts';
import { plotNumbers } from '../ui/plot-numbers.ts';
import {
  box,
  decal,
  GAP,
  MAP_STEP,
  MAP_VIEW,
  MARGIN,
  path,
  planOf,
  PLATE_R,
  PLATE_TH,
  project,
  R_TILE,
  roundedPlan,
  TH,
  type BoxShape,
  type Palette,
  type View,
} from './iso.ts';

const teamPalette = (team: Team): Palette => {
  const t = tokens.team[team];
  return [t.main, t.side, t.side2];
};

/** A palette from the tokens: top, left face, right face. */
export const tones = (colours: readonly string[]): Palette => [colours[0]!, colours[1]!, colours[2]!];

/** An icon's drawing without its outer <svg>, to lay inside a transformed group. */
export const iconInside = (name: string) => (iconSvg(name) ?? '').replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/** What one plot shows, and the height it should stand at. */
export type PlotLook = {
  id: PlotId;
  /** Back to front: plots are drawn in this order. */
  order: number;
  /** Where the plot sits in plan. */
  i: number;
  j: number;
  /** In plot units: a tile, or a building that rises with the plot's value. */
  height: number;
  palette: Palette;
  symbol?: Team;
  symbolSize: number;
  /** A building of another team, sunk to the ground while a team plays: its symbol fades. */
  faded?: boolean;
  /** A secret plan that has struck here: shown small on the roof from then on, beside the symbol. */
  plan?: boolean;
  card?: Card;
  /** A plot the team in turn can act on: one to build on rises to the building it would be; one to bid for
   * stays up. Either carries the dashed edge of a choice. */
  open?: Team;
  /** The number the leader of the team in turn calls out to build or bid there, as on the referee's map. */
  number?: number;
};

/**
 * Every plot, back to front, with what it shows. A building rises with its plot's value (a base counts
 * as 1, the tower as 5); a plot no one has built lies flat, with its card on it; the tower is flat until
 * a team takes it. While a team plays, the other teams' buildings sink to the ground, but the ones it can
 * bid for stay up; the plots it can build on rise to the building they would be. Each plot it can act on
 * carries the dashed edge of a choice and its number.
 */
export function boardLooks(state: GameState, night: boolean, step = MAP_STEP): PlotLook[] {
  const board = getBoard(state.setup.size);
  const n = board.size;
  const pal = night ? tokens.map.night : tokens.map.day;
  const focus = teamInTurn(state);
  // The plots the team in turn can build on or bid for, with the numbers its leader calls out.
  const open = plotNumbers(state);

  const looks = board.ids.map((id): PlotLook => {
    const info = board.plots[id]!;
    const plot = state.plots[id]!;
    const { i, j } = planOf(info.row, info.col, n);
    const centre = id === board.centre;
    const building = TH + (centre ? 5 : info.value) * step;
    const at = { id, order: i + j, i, j, symbolSize: centre ? 0.42 : 0.4 };

    if (plot.owner) {
      const bid = focus !== null && open.has(id);
      const sunk = focus !== null && plot.owner !== focus && !bid;
      return {
        ...at,
        height: sunk ? TH : building,
        palette: teamPalette(plot.owner),
        symbol: plot.owner,
        faded: sunk || undefined,
        plan: plot.planShown || undefined,
        open: bid ? focus : undefined,
        number: open.get(id),
      };
    }
    const palette = tones(centre ? pal.tower : info.value >= 4 ? pal.v4 : info.value === 3 ? pal.v3 : pal.v2);
    const card = plot.card ?? undefined;
    if (focus && open.has(id)) return { ...at, height: building, palette, card, open: focus, number: open.get(id) };
    return { ...at, height: TH, palette, card };
  });
  return looks.sort((a, b) => a.order - b.order);
}

/** A plot the moment just gave a team (built, won at auction, taken by a plan), with the population it is
 * worth; and for a bridge, the team's plot it jumped from, two steps away in the same row or column. */
export function landing(state: GameState, e: GameEvent): { plot: PlotId; team: Team; gain: number; from?: PlotId } | null {
  const board = getBoard(state.setup.size);
  const gain = (plot: PlotId) => (board.plots[plot]?.value ?? 0) * 100;
  switch (e.type) {
    case 'build': {
      const from = e.via === 'bridge' ? bridgeReach(board, e.plot).find((id) => state.plots[id]?.owner === e.team) : undefined;
      return { plot: e.plot, team: e.team, gain: gain(e.plot), from };
    }
    case 'plan/take':
      return { plot: e.plot, team: e.team, gain: gain(e.plot) };
    case 'challenge/result': {
      const auction = state.auctions[e.auction];
      if (auction?.status !== 'done' || auction.winner !== auction.bidder) return null;
      return { plot: auction.plot, team: auction.bidder, gain: gain(auction.plot) };
    }
    default:
      return null;
  }
}

/** The plot where the moment just made a plan strike, so the plan shows there from now on. */
export function struckPlan(state: GameState, e: GameEvent): PlotId | null {
  if (e.type !== 'challenge/result') return null;
  const auction = state.auctions[e.auction];
  const struck = auction?.status === 'done' && auction.winner === auction.defender && state.plots[auction.plot]?.planShown;
  return struck ? auction.plot : null;
}

export type PlotShape = {
  shape: BoxShape;
  /** Transforms that lay the team symbol, the card, or a plan that struck, flat on the plot's top. */
  symbol?: string;
  card?: string;
  plan?: string;
  /** The dashed edge on top of a plot the team in turn can build on. */
  edge?: string;
};

/** A plot drawn at a height (which moves while the map changes): its box, and what lies on its top. */
export function plotShape(look: PlotLook, height: number, s: number, n: number, view: View = MAP_VIEW): PlotShape {
  const g = GAP / 2;
  const [x0, y0, x1, y1] = [look.i + g, look.j + g, look.i + 1 - g, look.j + 1 - g];
  const cx = look.i + 0.5;
  const cy = look.j + 0.5;
  const inset = 0.08;
  return {
    shape: box([x0, y0, x1, y1], 0, height, R_TILE, s, n, view),
    symbol: look.symbol ? decal(cx, cy, height, look.symbolSize, s, n, view) : undefined,
    card: look.card ? decal(cx, cy, height, 0.56, s, n, view) : undefined,
    // In the roof's right corner, so the team's symbol stays and a number can take the top.
    plan: look.plan ? decal(cx + 0.27, cy - 0.27, height, 0.24, s, n, view) : undefined,
    edge: look.open
      ? path(
          roundedPlan(x0 + inset, y0 + inset, x1 - inset, y1 - inset, R_TILE * 0.7).map(([a, b]) => project(a, b, height, s, n, view)),
        )
      : undefined,
  };
}

/** The ground plate under the whole board. */
export function plateShape(s: number, n: number, view: View = MAP_VIEW): BoxShape {
  return box([-MARGIN, -MARGIN, n + MARGIN, n + MARGIN], -PLATE_TH, 0, PLATE_R, s, n, view);
}
