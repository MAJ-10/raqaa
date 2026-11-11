// The competition setup the referee fills in before «ابدأ».
import type { Random } from '../engine/content.ts';
import { MISSIONS, TEAMS, type Question, type Setup, type Team, type TeamSetup } from '../engine/types.ts';

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

/** The made-up teams of a demo. A real competition's names come from the referee. */
const DEMO_NAMES: Record<Team, string> = { coral: 'الرواد', blue: 'النجوم', green: 'الصقور', gold: 'الفرسان' };

/**
 * A demo competition, ready to start: made-up teams with two missions each, and sums for questions, so
 * the published code carries no real question. Once started, the referee window plays it by itself.
 */
export function demoSetup(random: Random = Math.random): Setup {
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const sum = (): Question => {
    const [a, b] = [between(3, 9), between(3, 9)];
    return { text: `كم يساوي ${a} × ${b}؟`, answer: String(a * b) };
  };
  const team = (name: string): TeamSetup => {
    const first = MISSIONS[between(0, MISSIONS.length - 1)]!;
    const others = MISSIONS.filter((m) => m !== first);
    return { name, players: between(3, 6), missions: [first, others[between(0, others.length - 1)]!] };
  };
  return {
    size: 9,
    days: 10,
    teams: Object.fromEntries(TEAMS.map((t) => [t, team(DEMO_NAMES[t])])) as Record<Team, TeamSetup>,
    questions: Array.from({ length: 30 }, sum),
    questionSource: { kind: 'demo', name: 'أسئلة تجريبية' },
    demo: true,
  };
}

type SetupProblem = { kind: 'name'; team: Team } | { kind: 'missions'; team: Team } | { kind: 'questions' };

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
