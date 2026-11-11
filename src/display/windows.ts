// What the display shows over the game at each moment, worked out from the state and the last event
// alone, so a display that reopens shows the same thing. Pure: the tests walk through every moment.
import { getBoard } from '../engine/board.ts';
import { announcement, type MissionResult } from '../engine/missions.ts';
import {
  buildOrder,
  currentChallenge,
  currentQuestion,
  openAuction,
  points,
  population,
  populationHidden,
  teamInTurn,
  TIMER_SECONDS,
  timerSeconds,
} from '../engine/select.ts';
import type { Auction, Card, Challenge, GameEvent, GameState, Team } from '../engine/types.ts';
import { CARD_THE } from '../ui/names.ts';

/** How long a card's window, and the end of an auction, stay after their event. */
export const MOMENT = 3000;

/**
 * How long the answer stays with the permits marked, once the referee confirms them: long enough to see
 * who builds, then the team in turn needs the map to choose where.
 */
export const PERMITS_TIME = 4000;

/** How long the bridge's line takes to jump to its plot. */
export const JUMP_DRAW = 650;

/**
 * How long after its event a moment's window waits, so the map shows what happened first: a card taken
 * waits for its building to land, and a bridge's card for its line to jump and the building to land.
 */
export const LAND = 800;
export const JUMP = 1400;
/** When a card's window starts to turn the card over, after the window comes. */
export const CARD_FLIP = 580;

export const waitOf = (e: GameEvent) => (e.type !== 'build' ? 0 : e.via === 'bridge' ? JUMP : LAND);

/** When the clock should next look again: when a window that comes or goes by itself does, or never. */
export function nextWake(last: GameEvent | null, now: number): number | null {
  if (!last) return null;
  const marks = last.type === 'permits/set' ? [PERMITS_TIME] : [waitOf(last), waitOf(last) + MOMENT];
  for (const mark of marks) if (last.at + mark > now) return last.at + mark;
  return null;
}

/** A timer on screen: when it started and how many seconds it runs. */
export type Running = { startedAt: number; seconds: number };

export type DisplayWindow =
  /** «عرض الأرقام» in an individual question: each team's player number. */
  | { kind: 'numbers'; numbers: Record<Team, number> }
  /** The question, and a timer for a group question. Null text: the referee asks a question of their own. */
  | { kind: 'question'; text: string | null; timer: Running | null }
  /**
   * The answer, and the teams in build order. Once the referee confirms the permits, each team is marked:
   * a permit, or in a group question a wrong answer; then the window goes after a few seconds, or with the
   * first move of the build if it comes sooner.
   */
  | { kind: 'answer'; answer: string | null; teams: Team[]; permits: Team[] | null; individual: boolean }
  /** The open auction, or one just won: the two sides, and the challenge being played or the last one. */
  | { kind: 'auction'; auction: Auction; challenge: Challenge | null; timer: Running | null }
  /** A card taken or used: the card, and the team with what it did. Gone by itself (`until`) after a moment. */
  | { kind: 'card'; card: Card; team: Team; says: string; also: Team | null; until: number; taken: boolean }
  /** A secret mission in the announcement, with its result. */
  | { kind: 'mission'; team: Team; result: MissionResult };

/** The card a move took or used, if it did. Placing a plan shows nothing: the plan stays secret. */
function cardMoment(state: GameState, e: GameEvent): DisplayWindow | null {
  switch (e.type) {
    case 'build': {
      const card = getBoard(state.setup.size).plots[e.plot]?.card;
      if (card) return { kind: 'card', card, team: e.team, says: `كسب ${CARD_THE[card]}`, also: null, until: e.at + waitOf(e) + MOMENT, taken: true };
      if (e.via === 'bridge') return { kind: 'card', card: 'bridge', team: e.team, says: 'بنى بالجسر', also: null, until: e.at + waitOf(e) + MOMENT, taken: false };
      return null;
    }
    case 'card/fence': {
      const auction = state.auctions[e.auction];
      if (!auction) return null;
      return { kind: 'card', card: 'fence', team: auction.defender, says: 'صدّ المزاد بالسياج', also: auction.bidder, until: e.at + waitOf(e) + MOMENT, taken: false };
    }
    case 'card/crane':
      return { kind: 'card', card: 'crane', team: e.team, says: 'استخدم الرافعة', also: null, until: e.at + waitOf(e) + MOMENT, taken: false };
    case 'card/inspector':
      return { kind: 'card', card: 'inspector', team: e.team, says: 'استخدم مفتش البلدية', also: null, until: e.at + waitOf(e) + MOMENT, taken: false };
    case 'plan/take':
      return { kind: 'card', card: 'plan', team: e.team, says: 'أخذ قطعة بالمخطط السري', also: null, until: e.at + waitOf(e) + MOMENT, taken: false };
    default:
      return null;
  }
}

/** The auction's window: the challenge being played, or else the last one played, with its result. */
function auctionWindow(state: GameState, auction: Auction): DisplayWindow {
  const challenge = currentChallenge(auction) ?? auction.challenges.at(-1) ?? null;
  const seconds = timerSeconds(state);
  const timer = state.timer?.kind === 'challenge' && seconds ? { startedAt: state.timer.startedAt, seconds } : null;
  return { kind: 'auction', auction, challenge, timer };
}

function answerWindow(state: GameState, permits: Team[] | null): DisplayWindow {
  return {
    kind: 'answer',
    answer: currentQuestion(state)?.answer ?? null,
    teams: buildOrder(state),
    permits,
    individual: state.question.kind === 'individual',
  };
}

/** The window over the game now, or null when the game shows plainly. `now` is the clock, in ms. */
export function displayWindow(state: GameState, last: GameEvent | null, now: number): DisplayWindow | null {
  const wait = last ? waitOf(last) : 0;
  if (last && now - last.at >= wait && now - last.at < wait + MOMENT) {
    const moment = cardMoment(state, last);
    if (moment) return moment;
    // The auction just ended: its window stays a moment, with the last win, before the map shows the result.
    if (last.type === 'challenge/result' && state.auctions[last.auction]?.status === 'done') {
      return auctionWindow(state, state.auctions[last.auction]!);
    }
  }
  if (last?.type === 'permits/set' && now - last.at < PERMITS_TIME) return answerWindow(state, state.permits);

  switch (state.step) {
    case 'question':
      return state.question.numbers ? { kind: 'numbers', numbers: state.question.numbers } : null;
    case 'asking': {
      const timer = state.timer ? { startedAt: state.timer.startedAt, seconds: TIMER_SECONDS.question } : null;
      return { kind: 'question', text: currentQuestion(state)?.text ?? null, timer };
    }
    case 'answer':
      return answerWindow(state, null);
    case 'auctions': {
      const auction = openAuction(state);
      return auction ? auctionWindow(state, auction) : null;
    }
    case 'announce': {
      const step = announcement(state)[state.announce];
      return step?.kind === 'mission' ? { kind: 'mission', team: step.team, result: step.result } : null;
    }
    default:
      return null;
  }
}

/** The announcement's step on screen: map population, a mission, or the podium. */
export function announceStep(state: GameState) {
  return state.step === 'announce' ? (announcement(state)[state.announce] ?? null) : null;
}

/**
 * A team's population during the announcement: its map, plus every mission shown so far. It counts up
 * as each mission is revealed.
 */
export function announcedPopulation(state: GameState, team: Team): number {
  const shown = announcement(state).slice(0, state.announce + 1);
  const missions = shown.reduce((sum, step) => sum + (step.kind === 'mission' && step.team === team ? step.result.points : 0), 0);
  return (points(state, team) + missions) * 100;
}

/** What a team's boards show: faded behind a window it has no part in, filled while it acts. */
export type SignLook = {
  faded: boolean;
  filled: boolean;
  /** The board under the name: the population, the player's number, or nothing but the cards. */
  board: { population: number } | { number: number } | null;
};

/** How each team's boards look now, given the window on screen. */
export function signLook(state: GameState, team: Team, window: DisplayWindow | null): SignLook {
  const step = announceStep(state);
  if (step) {
    // The announcement shows every population again, the last days included.
    const own = window?.kind === 'mission' ? window.team === team : true;
    return { faded: !own, filled: own, board: { population: announcedPopulation(state, team) } };
  }

  const numbers = state.question.numbers;
  const board: SignLook['board'] =
    state.step === 'asking' && numbers
      ? { number: numbers[team] }
      : populationHidden(state)
        ? null
        : { population: population(state, team) };

  switch (window?.kind) {
    case 'question':
      // Everyone answers: every board is lit, with its player's number in an individual question.
      return { faded: false, filled: true, board };
    case 'card': {
      const own = window.team === team || window.also === team;
      return { faded: !own, filled: own, board };
    }
    case undefined:
      // No window: the team that plays fills with its colour.
      return { faded: false, filled: teamInTurn(state) === team, board };
    default:
      return { faded: true, filled: false, board };
  }
}
