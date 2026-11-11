// Types of the rules engine. Names follow the glossary (القاموس) in the requirements.

export const TEAMS = ['coral', 'blue', 'green', 'gold'] as const;
export type Team = (typeof TEAMS)[number];

export type Size = 7 | 9;

/** A plot's id is "row-col": rows from the top, columns from the right, from 1. */
export type PlotId = string;

const CARDS = ['fence', 'crane', 'bridge', 'plan', 'inspector'] as const;
export type Card = (typeof CARDS)[number];

export const MISSIONS = [
  'innerStreet', // شارع داخلي
  'block', // مربع سكني
  'collector', // جامع البطاقات
  'everyRing', // يد في كل حلقة
  'twoTeams', // من حيين
  'successfulBidder', // مزايد ناجح
  'tower', // برج الرقعة
  'heart', // قلب المدينة
  'neighbourOfAll', // جار الجميع
] as const;
export type Mission = (typeof MISSIONS)[number];

export const CHALLENGES = ['math', 'spelling', 'memory', 'ordering', 'precision', 'building'] as const;
export type ChallengeType = (typeof CHALLENGES)[number];

export type Question = { text: string; answer: string };

/** The referee chooses each day: individual (one player per team, one permit) or group. */
export type QuestionKind = 'individual' | 'group';

export type TeamSetup = { name: string; players: number; missions: Mission[] };

/** Where the questions came from: the referee's file, or the made-up sums of a demo. */
export type QuestionSource = { kind: 'file' | 'demo'; name: string };

export type Setup = {
  size: Size;
  days: number;
  teams: Record<Team, TeamSetup>;
  questions: Question[];
  questionSource?: QuestionSource | null;
  /** A demo competition: the referee window plays it by itself (engine/autoplay.ts). */
  demo?: boolean;
};

export type MathOp = '+' | '-' | '*' | '/';

/** Generated in the referee window and kept in the event, so replaying the events gives the same content. */
export type ChallengeContent =
  | { type: 'math'; start: number; steps: { op: MathOp; n: number }[]; answer: number }
  | { type: 'spelling'; id: string } // a spelling bank id
  | { type: 'memory'; kind: 'images' | 'words'; items: string[] }
  | { type: 'ordering'; id: string; order: number[] } // a sentence bank id, and the order its words are shown in
  | { type: 'precision' }
  | { type: 'building' };

/** Every event carries the time it happened, in milliseconds. */
export type GameEvent = { at: number } & (
  | { type: 'game/start' }
  | { type: 'question/kind'; kind: QuestionKind }
  | { type: 'numbers/show' }
  | { type: 'question/show' }
  | { type: 'question/replace' }
  | { type: 'question/outside' }
  | { type: 'answer/show' }
  | { type: 'timer/end' }
  | { type: 'timer/restart' }
  | { type: 'permits/set'; teams: Team[] }
  | { type: 'build'; team: Team; plot: PlotId; via?: 'bridge' }
  | { type: 'auction/declare'; team: Team; plot: PlotId }
  | { type: 'card/fence'; auction: number }
  | { type: 'fence/skip'; auction: number }
  | { type: 'card/crane'; team: Team }
  | { type: 'card/plan'; team: Team; plots: [PlotId, PlotId] }
  | { type: 'card/inspector'; team: Team; target: Team }
  | { type: 'turn/pass'; team: Team }
  | { type: 'auction/open'; auction: number }
  | { type: 'challenge/start'; auction: number; content: ChallengeContent }
  | { type: 'challenge/result'; auction: number; winner: Team }
  | { type: 'challenge/replay'; auction: number; content: ChallengeContent }
  | { type: 'plan/take'; team: Team; plot: PlotId }
  | { type: 'day/end' }
  | { type: 'days/extend'; count: number }
  | { type: 'game/end' }
  | { type: 'announce/next' }
);


type WithoutTime<E> = E extends unknown ? Omit<E, 'at'> : never;

/** An event before it gets its time: the referee window stamps it when it happens. */
export type EventInput = WithoutTime<GameEvent>;

/** Where the day stands. */
export type Step =
  | 'setup' // before game/start
  | 'question' // the day's question is ready, not shown yet
  | 'asking' // the question is on screen and its timer runs
  | 'answer' // the answer is shown; the referee sets the permits
  | 'build' // teams move in build order
  | 'auctions' // the day's auctions, one by one
  | 'dayEnd' // next day, or on the last day extend or announce
  | 'announce'; // the final announcement

export type PlotState = {
  owner: Team | null;
  /** The day it was built or changed owner; null for bases and empty plots. */
  since: number | null;
  /** The card lying on it, until a team builds there. */
  card: Card | null;
  /** The team whose secret plan sits on it. */
  plan: Team | null;
  /** True once the plan has fired here, so the display may show it. */
  planShown: boolean;
};

export type TeamState = {
  /** Cards taken and not used yet. A plan is placed as soon as it is taken, so it never waits here. */
  cards: Card[];
  cardUsedToday: boolean;
  /** Player number for the next individual question, from 1 to the team's players. */
  questionCounter: number;
  /** Player number for the next auction the team enters, from 1 to the team's players. */
  bidderCounter: number;
  /** Moves left today. */
  moves: number;
  // History, for the secret missions and the final ranking.
  cardsTaken: number;
  takenFrom: Team[];
  bidderWins: number;
  /** Builds, bridge builds and auction declarations over the whole competition. */
  moveCount: number;
};

export type Challenge = {
  content: ChallengeContent;
  startedAt: number;
  /** The timer ran out: the challenge stops and its answer shows. */
  stopped: boolean;
  winner: Team | null;
};

export type AuctionStatus = 'declared' | 'fenced' | 'cancelled' | 'open' | 'done';

export type Auction = {
  id: number;
  day: number;
  bidder: Team;
  defender: Team;
  plot: PlotId;
  status: AuctionStatus;
  /** Player numbers, reserved when the auction opens. */
  players: { bidder: number; defender: number } | null;
  challenges: Challenge[];
  winner: Team | null;
};

/** Something the referee has to settle before anything else happens. */
export type Pending =
  | { kind: 'fence'; auction: number } // the defender decides: use the fence or not
  | { kind: 'plan'; team: Team } // the team places the plan it just took
  | { kind: 'inspector'; team: Team } // the team looks at another team's missions as soon as it takes the inspector
  | { kind: 'planTake'; team: Team; from: Team; plot: PlotId }; // the plan fired: pick a plot of the losing bidder

export type GameState = {
  setup: Setup;
  step: Step;
  day: number;
  /** Total days; grows with extensions. */
  days: number;
  question: {
    /** Null until the referee chooses. */
    kind: QuestionKind | null;
    /** Index into setup.questions, or null when the file ran out. */
    index: number | null;
    /** Player numbers for an individual question, once shown. */
    numbers: Record<Team, number> | null;
    /** The referee asks a question of their own instead of the file's. */
    outside: boolean;
  };
  /** Next unused question. Shown or replaced questions never come back. */
  nextQuestion: number;
  permits: Team[];
  order: Team[];
  turn: Team | null;
  turnIndex: number;
  pending: Pending | null;
  plots: Record<PlotId, PlotState>;
  teams: Record<Team, TeamState>;
  auctions: Auction[];
  timer: { kind: 'question' | 'challenge'; startedAt: number } | null;
  /** Challenge content already shown, oldest first, so nothing repeats. */
  used: { spelling: string[]; ordering: string[]; images: string[]; words: string[] };
  /** Memory challenges so far; they alternate between images and words. */
  memoryCount: number;
  inspections: { team: Team; target: Team; day: number }[];
  /** Steps passed in the final announcement. */
  announce: number;
};
