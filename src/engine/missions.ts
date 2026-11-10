// Secret missions, the final score and ranking, and the steps of the announcement.
import { neighbours, onEdge, plotId } from './board.ts';
import { boardOf, points, teamPlots } from './select.ts';
import { TEAMS, type GameState, type Mission, type Team } from './types.ts';

export type Level = 'easy' | 'medium' | 'hard';

export const MISSION_LEVEL: Record<Mission, Level> = {
  innerStreet: 'easy',
  block: 'easy',
  collector: 'easy',
  everyRing: 'medium',
  twoTeams: 'medium',
  successfulBidder: 'medium',
  tower: 'hard',
  heart: 'hard',
  neighbourOfAll: 'hard',
};

/** Points for success and for failure. */
export const MISSION_REWARD: Record<Level, { done: number; failed: number }> = {
  easy: { done: 4, failed: -2 },
  medium: { done: 8, failed: -4 },
  hard: { done: 12, failed: -6 },
};

/** Whether the team has achieved the mission. Map missions read the map as it is now. */
export function missionDone(s: GameState, team: Team, mission: Mission): boolean {
  const board = boardOf(s);
  const own = teamPlots(s, team);
  const owns = (id: string) => s.plots[id]?.owner === team;
  const history = s.teams[team];

  switch (mission) {
    case 'innerStreet':
      // 4 plots in a row or column, none on the map's outer row or column.
      return own.some((id) => {
        const { row, col } = board.plots[id]!;
        return [
          [0, 1],
          [1, 0],
        ].some(([dr, dc]) =>
          [0, 1, 2, 3].every((k) => {
            const next = plotId(row + dr! * k, col + dc! * k);
            return owns(next) && !onEdge(board, next);
          }),
        );
      });
    case 'block':
      // A 2×2 square, without the base.
      return own.some((id) => {
        const { row, col } = board.plots[id]!;
        const square = [plotId(row, col), plotId(row, col + 1), plotId(row + 1, col), plotId(row + 1, col + 1)];
        return square.every((p) => owns(p) && !board.plots[p]?.base);
      });
    case 'collector':
      return history.cardsTaken >= 2;
    case 'everyRing':
      // A plot in ring 1 (value 4), ring 2 (value 3) and the outer ring (value 2). The base doesn't count.
      return [4, 3, 2].every((value) => own.some((id) => board.plots[id]?.value === value));
    case 'twoTeams':
      return new Set(history.takenFrom).size >= 2;
    case 'successfulBidder':
      return history.bidderWins >= 2;
    case 'tower':
      return owns(board.centre);
    case 'heart':
      return own.filter((id) => board.plots[id]?.ring === 1).length >= 3;
    case 'neighbourOfAll':
      return TEAMS.filter((other) => other !== team).every((other) =>
        own.some((id) => neighbours(board, id).some((near) => s.plots[near]?.owner === other)),
      );
  }
}

export type MissionResult = { mission: Mission; level: Level; done: boolean; points: number };

export function missionResults(s: GameState, team: Team): MissionResult[] {
  return s.setup.teams[team].missions.map((mission) => {
    const level = MISSION_LEVEL[mission];
    const done = missionDone(s, team, mission);
    const reward = MISSION_REWARD[level];
    return { mission, level, done, points: done ? reward.done : reward.failed };
  });
}

export type Standing = {
  team: Team;
  mapPoints: number;
  missionPoints: number;
  /** Map points plus mission points. */
  score: number;
  plots: number;
  moves: number;
  /** 1 for the winner. Teams still tied after every rule share a rank. */
  rank: number;
};

/** Ranked by score, then most plots, then most moves over the competition. */
export function ranking(s: GameState): Standing[] {
  const rows = TEAMS.map((team) => {
    const mapPoints = points(s, team);
    const missionPoints = missionResults(s, team).reduce((sum, r) => sum + r.points, 0);
    return {
      team,
      mapPoints,
      missionPoints,
      score: mapPoints + missionPoints,
      plots: teamPlots(s, team).length,
      moves: s.teams[team].moveCount,
      rank: 0,
    };
  });
  const better = (a: Standing, b: Standing) =>
    a.score - b.score || a.plots - b.plots || a.moves - b.moves;
  for (const row of rows) row.rank = 1 + rows.filter((other) => better(other, row) > 0).length;
  return rows.sort((a, b) => a.rank - b.rank || TEAMS.indexOf(a.team) - TEAMS.indexOf(b.team));
}

export type AnnounceStep =
  | { kind: 'population' }
  | { kind: 'mission'; team: Team; result: MissionResult }
  | { kind: 'podium' };

/** The announcement: map population, then every mission one by one, then the podium. */
export function announcement(s: GameState): AnnounceStep[] {
  const missions = TEAMS.flatMap((team) =>
    missionResults(s, team).map((result): AnnounceStep => ({ kind: 'mission', team, result })),
  );
  return [{ kind: 'population' }, ...missions, { kind: 'podium' }];
}
