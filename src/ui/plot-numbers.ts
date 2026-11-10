import { getBoard } from '../engine/board.ts';
import { options, teamInTurn } from '../engine/select.ts';
import type { GameState, PlotId } from '../engine/types.ts';

/**
 * The plots the team in turn can act on: build (its bridge's plots too) or bid for. Each has the number its
 * leader calls out to the referee: the display shows the numbers on its map, and the referee's map shows
 * the same ones. They count the way the display's map reads, from its back to its front, right to left.
 */
export function plotNumbers(state: GameState): Map<PlotId, number> {
  const team = teamInTurn(state);
  if (!team) return new Map();
  const { build, bridge, auction } = options(state, team);
  const board = getBoard(state.setup.size);
  const n = board.size;
  // On the display's map a plot stands deeper the larger (n − column) + (row − 1), and further right the
  // larger (n − column) − (row − 1).
  const place = (id: PlotId) => {
    const plot = board.plots[id]!;
    return { depth: n - plot.col + plot.row - 1, right: n - plot.col - (plot.row - 1) };
  };
  const ids = [...build, ...bridge, ...auction].sort((a, b) => place(a).depth - place(b).depth || place(b).right - place(a).right);
  return new Map(ids.map((id, k) => [id, k + 1]));
}
