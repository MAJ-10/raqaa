// The map for both sizes: plots, rings, values, bases, card plots and adjacency.
// Coordinates are (row, col): rows from the top, columns from the right, from 1.
import { TEAMS, type Card, type PlotId, type Size, type Team } from './types.ts';

type PlotInfo = {
  id: PlotId;
  row: number;
  col: number;
  /** Distance from the centre: the larger of the row and column distances. */
  ring: number;
  /** Points: tower 5, ring 1 → 4, ring 2 → 3, further out 2, bases 1. */
  value: number;
  base: Team | null;
  /** The card lying here at the start. */
  card: Card | null;
};

export type Board = {
  size: Size;
  centre: PlotId;
  ids: PlotId[];
  plots: Record<PlotId, PlotInfo>;
};

export const plotId = (row: number, col: number): PlotId => `${row}-${col}`;

// The same cards at the same distance from every base.
const CARD_PLOTS: Record<Size, Record<Card, [number, number][]>> = {
  9: {
    fence: [[2, 3], [2, 7], [8, 3], [8, 7]],
    crane: [[3, 2], [3, 8], [7, 2], [7, 8]],
    bridge: [[3, 5], [7, 5]],
    plan: [[4, 5], [6, 5]],
    inspector: [[5, 4], [5, 6]],
  },
  7: {
    fence: [[2, 3], [2, 5], [6, 3], [6, 5]],
    crane: [[3, 2], [3, 6], [5, 2], [5, 6]],
    bridge: [[2, 4], [6, 4]],
    plan: [[3, 4], [5, 4]],
    inspector: [[4, 3], [4, 5]],
  },
};

/** Each base sits in the corner that matches its team's corner on the display. */
export function basePlot(size: Size, team: Team): PlotId {
  const corners: Record<Team, [number, number]> = {
    coral: [1, 1], // top right
    blue: [1, size], // top left
    green: [size, 1], // bottom right
    gold: [size, size], // bottom left
  };
  const [row, col] = corners[team];
  return plotId(row, col);
}

const RING_VALUES = [5, 4, 3];

function buildBoard(size: Size): Board {
  const middle = (size + 1) / 2;
  const bases = new Map<PlotId, Team>(TEAMS.map((team) => [basePlot(size, team), team]));
  const cards = new Map<PlotId, Card>();
  for (const [card, places] of Object.entries(CARD_PLOTS[size]) as [Card, [number, number][]][]) {
    for (const [row, col] of places) cards.set(plotId(row, col), card);
  }
  const plots: Record<PlotId, PlotInfo> = {};
  const ids: PlotId[] = [];
  for (let row = 1; row <= size; row++) {
    for (let col = 1; col <= size; col++) {
      const id = plotId(row, col);
      const ring = Math.max(Math.abs(row - middle), Math.abs(col - middle));
      const base = bases.get(id) ?? null;
      plots[id] = { id, row, col, ring, value: base ? 1 : (RING_VALUES[ring] ?? 2), base, card: cards.get(id) ?? null };
      ids.push(id);
    }
  }
  return { size, centre: plotId(middle, middle), ids, plots };
}

const boards = new Map<Size, Board>();

export function getBoard(size: Size): Board {
  let board = boards.get(size);
  if (!board) {
    board = buildBoard(size);
    boards.set(size, board);
  }
  return board;
}

/** Plots that share an edge with this one. Diagonal plots are not neighbours. */
export function neighbours(board: Board, id: PlotId): PlotId[] {
  const plot = board.plots[id];
  if (!plot) return [];
  const around = [
    [plot.row - 1, plot.col],
    [plot.row + 1, plot.col],
    [plot.row, plot.col - 1],
    [plot.row, plot.col + 1],
  ];
  return around.map(([row, col]) => plotId(row!, col!)).filter((near) => near in board.plots);
}

/** Plots two steps away in the same row or column: where a bridge can land from this plot. */
export function bridgeReach(board: Board, id: PlotId): PlotId[] {
  const plot = board.plots[id];
  if (!plot) return [];
  const around = [
    [plot.row - 2, plot.col],
    [plot.row + 2, plot.col],
    [plot.row, plot.col - 2],
    [plot.row, plot.col + 2],
  ];
  return around.map(([row, col]) => plotId(row!, col!)).filter((far) => far in board.plots);
}

/** True for plots on the map's outer row or column. */
export function onEdge(board: Board, id: PlotId): boolean {
  const plot = board.plots[id];
  return !!plot && (plot.row === 1 || plot.col === 1 || plot.row === board.size || plot.col === board.size);
}
