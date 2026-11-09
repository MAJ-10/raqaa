// Read-only questions about a game state: availability, build order, points, auctions.
import { bridgeReach, getBoard, neighbours, type Board } from './board.ts';
import { TEAMS, type Auction, type Card, type Challenge, type GameState, type PlotId, type Question, type Team } from './types.ts';

export const boardOf = (s: GameState): Board => getBoard(s.setup.size);

export function teamPlots(s: GameState, team: Team): PlotId[] {
  return boardOf(s).ids.filter((id) => s.plots[id]?.owner === team);
}

/** Map points: the values of the team's plots, its base included. */
export function points(s: GameState, team: Team): number {
  const board = boardOf(s);
  return teamPlots(s, team).reduce((sum, id) => sum + (board.plots[id]?.value ?? 0), 0);
}

/** What the screens show: points × 100. */
export const population = (s: GameState, team: Team): number => points(s, team) * 100;

function touches(s: GameState, team: Team, id: PlotId): boolean {
  return neighbours(boardOf(s), id).some((near) => s.plots[near]?.owner === team);
}

/** Build: an empty plot next to the team's land. Diagonal doesn't count. */
export function canBuild(s: GameState, team: Team, id: PlotId): boolean {
  return s.plots[id]?.owner === null && touches(s, team, id);
}

/** Bridge: an empty plot not next to the team's land, with a team plot two steps away in its row or column. */
export function canBridge(s: GameState, team: Team, id: PlotId): boolean {
  return (
    s.plots[id]?.owner === null &&
    !touches(s, team, id) &&
    bridgeReach(boardOf(s), id).some((far) => s.plots[far]?.owner === team)
  );
}

/**
 * Auction: another team's plot next to the bidder's land; never a base; not built or taken today or
 * yesterday; and no auction declared on it today.
 */
export function canAuction(s: GameState, bidder: Team, id: PlotId): boolean {
  const plot = s.plots[id];
  if (!plot?.owner || plot.owner === bidder || boardOf(s).plots[id]?.base) return false;
  if (plot.since !== null && plot.since >= s.day - 1) return false;
  if (s.auctions.some((a) => a.day === s.day && a.plot === id)) return false;
  return touches(s, bidder, id);
}

export function canUseCard(s: GameState, team: Team, card: Card): boolean {
  const t = s.teams[team];
  return t.cards.includes(card) && !t.cardUsedToday;
}

export type Options = { build: PlotId[]; bridge: PlotId[]; auction: PlotId[] };

/** The plots a team can act on now. Bridge plots only when the team can use its bridge today. */
export function options(s: GameState, team: Team): Options {
  const ids = boardOf(s).ids;
  return {
    build: ids.filter((id) => canBuild(s, team, id)),
    bridge: canUseCard(s, team, 'bridge') ? ids.filter((id) => canBridge(s, team, id)) : [],
    auction: ids.filter((id) => canAuction(s, team, id)),
  };
}

function hasMove(s: GameState, team: Team, withBridge: boolean): boolean {
  return boardOf(s).ids.some(
    (id) => canBuild(s, team, id) || canAuction(s, team, id) || (withBridge && canBridge(s, team, id)),
  );
}

/**
 * Whether the team can still act in its turn: it has a move and somewhere to use it, or it is out of
 * moves but could use a crane for one more.
 */
export function canStillAct(s: GameState, team: Team): boolean {
  if (s.teams[team].moves > 0) return hasMove(s, team, canUseCard(s, team, 'bridge'));
  return canUseCard(s, team, 'crane') && hasMove(s, team, false);
}

/**
 * Fewest points first, then fewest plots, then a fixed order that turns every day:
 * coral, blue, green, gold on day 1; day 2 starts with blue.
 */
export function buildOrder(s: GameState): Team[] {
  const shift = (s.day - 1) % TEAMS.length;
  const fixed = (team: Team) => (TEAMS.indexOf(team) - shift + TEAMS.length) % TEAMS.length;
  return [...TEAMS].sort(
    (a, b) =>
      points(s, a) - points(s, b) || teamPlots(s, a).length - teamPlots(s, b).length || fixed(a) - fixed(b),
  );
}

/** The day's question from the file, or null when the referee asks their own or the file ran out. */
export function currentQuestion(s: GameState): Question | null {
  if (s.question.outside || s.question.index === null) return null;
  return s.setup.questions[s.question.index] ?? null;
}

export function questionsLeft(s: GameState): number {
  return Math.max(0, s.setup.questions.length - s.nextQuestion);
}

/** Every plot is owned (bases are owned from the start). */
export function isMapFull(s: GameState): boolean {
  return boardOf(s).ids.every((id) => s.plots[id]?.owner !== null);
}

/** The last three days of the setup, and every extension after them: the display hides the population. */
export function populationHidden(s: GameState): boolean {
  return s.day > s.setup.days - 3;
}

export function todaysAuctions(s: GameState): Auction[] {
  return s.auctions.filter((a) => a.day === s.day);
}

/** The next auction to open: the first declared today that isn't open, done or cancelled. */
export function nextAuction(s: GameState): Auction | null {
  return s.auctions.find((a) => a.day === s.day && a.status === 'declared') ?? null;
}

export function openAuction(s: GameState): Auction | null {
  return s.auctions.find((a) => a.status === 'open') ?? null;
}

export function wins(auction: Auction, team: Team): number {
  return auction.challenges.filter((c) => c.winner === team).length;
}

/** The challenge being played: the last one, while it has no winner. */
export function currentChallenge(auction: Auction): Challenge | null {
  const last = auction.challenges.at(-1);
  return last && !last.winner ? last : null;
}

/** Where a fired plan can strike: the losing bidder's plots next to the plan plot, never a base. */
export function planTargets(s: GameState, from: Team, planPlot: PlotId): PlotId[] {
  const board = boardOf(s);
  return neighbours(board, planPlot).filter((id) => s.plots[id]?.owner === from && !board.plots[id]?.base);
}
