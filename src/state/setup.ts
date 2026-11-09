// The competition setup the referee fills in before «ابدأ».
import { TEAMS, type Setup, type Team, type TeamSetup } from '../engine/types.ts';

export const LIMITS = {
  name: 14,
  players: { min: 1, max: 20 },
  days: { min: 1, max: 30 },
  missions: { min: 1, max: 3 },
} as const;

export function defaultSetup(): Setup {
  const team = (): TeamSetup => ({ name: '', players: 6, missions: [] });
  return {
    size: 9,
    days: 12,
    teams: { coral: team(), blue: team(), green: team(), gold: team() },
    questions: [],
    questionSource: null,
  };
}

export type SetupProblem = { kind: 'name'; team: Team } | { kind: 'missions'; team: Team } | { kind: 'questions' };

/** What still stops the competition from starting. Empty when it is ready. */
export function setupProblems(setup: Setup): SetupProblem[] {
  const problems: SetupProblem[] = [];
  for (const team of TEAMS) {
    const t = setup.teams[team];
    if (!t.name.trim()) problems.push({ kind: 'name', team });
    if (t.missions.length < LIMITS.missions.min || t.missions.length > LIMITS.missions.max) {
      problems.push({ kind: 'missions', team });
    }
  }
  if (setup.questions.length === 0) problems.push({ kind: 'questions' });
  return problems;
}

export const isReady = (setup: Setup): boolean => setupProblems(setup).length === 0;
