// The rules as a pure function: reduce(state, event) → new state. The state of a competition is the
// fold of its events over initialState(setup), so undo is "drop the last event and fold again".
import { getBoard } from './board.ts';
import { announcement } from './missions.ts';
import {
  buildOrder,
  canAuction,
  canBridge,
  canBuild,
  canStillAct,
  canUseCard,
  currentChallenge,
  nextAuction,
  openAuction,
  planTargets,
  wins,
} from './select.ts';
import {
  TEAMS,
  type Auction,
  type Card,
  type ChallengeContent,
  type GameEvent,
  type GameState,
  type PlotId,
  type PlotState,
  type Setup,
  type Team,
  type TeamState,
} from './types.ts';

/** An event that breaks a rule. The referee screen only offers allowed actions, so this means a bug. */
export class RuleError extends Error {
  override name = 'RuleError';
}

function rule(ok: unknown, message: string): asserts ok {
  if (!ok) throw new RuleError(message);
}

export function initialState(setup: Setup): GameState {
  const board = getBoard(setup.size);
  const plots: Record<PlotId, PlotState> = {};
  for (const id of board.ids) {
    const info = board.plots[id]!;
    plots[id] = { owner: info.base, since: null, card: info.card, plan: null, planShown: false };
  }
  const team = (): TeamState => ({
    cards: [],
    cardUsedToday: false,
    questionCounter: 1,
    bidderCounter: 1,
    moves: 0,
    cardsTaken: 0,
    takenFrom: [],
    bidderWins: 0,
    moveCount: 0,
  });
  return {
    setup,
    step: 'setup',
    day: 0,
    days: setup.days,
    question: { kind: 'individual', index: null, numbers: null },
    nextQuestion: 0,
    permits: [],
    order: [],
    turn: null,
    turnIndex: 0,
    pending: null,
    plots,
    teams: { coral: team(), blue: team(), green: team(), gold: team() },
    auctions: [],
    timer: null,
    used: { spelling: [], ordering: [], images: [], words: [] },
    memoryCount: 0,
    inspections: [],
    announce: 0,
  };
}

/** Applies one event and returns the new state; the old state is left as it was. Throws RuleError. */
export function reduce(state: GameState, event: GameEvent): GameState {
  const { setup, ...rest } = state;
  const s: GameState = { ...structuredClone(rest), setup };
  apply(s, event);
  return s;
}

/** The state after a list of events. */
export function replay(setup: Setup, events: readonly GameEvent[]): GameState {
  return events.reduce(reduce, initialState(setup));
}

const nextPlayer = (counter: number, players: number) => (counter % players) + 1;

function takeQuestion(s: GameState): number | null {
  return s.nextQuestion < s.setup.questions.length ? s.nextQuestion++ : null;
}

function startDay(s: GameState): void {
  s.day += 1;
  s.step = 'question';
  // Individual and group questions alternate, starting with individual on day 1.
  s.question = { kind: s.day % 2 === 1 ? 'individual' : 'group', index: takeQuestion(s), numbers: null };
  s.permits = [];
  s.order = [];
  s.turn = null;
  s.turnIndex = 0;
  s.pending = null;
  s.timer = null;
  for (const team of TEAMS) {
    s.teams[team].cardUsedToday = false;
    s.teams[team].moves = 0;
  }
}

/** Gives the turn to the next team that can still act. When none can, building is over. */
function settleTurn(s: GameState): void {
  if (s.step !== 'build' || s.pending) return;
  while (s.turnIndex < s.order.length) {
    const team = s.order[s.turnIndex]!;
    if (canStillAct(s, team)) {
      s.turn = team;
      return;
    }
    s.teams[team].moves = 0;
    s.turnIndex += 1;
  }
  s.turn = null;
  s.step = 'auctions';
  settleAuctions(s);
}

/** When no auction is left to play today, the day ends. */
function settleAuctions(s: GameState): void {
  if (s.step !== 'auctions' || s.pending) return;
  if (!nextAuction(s) && !openAuction(s)) s.step = 'dayEnd';
}

function myTurn(s: GameState, team: Team): void {
  rule(s.step === 'build' && !s.pending && s.turn === team, `It is not ${team}'s turn`);
}

function spendCard(s: GameState, team: Team, card: Card): void {
  rule(canUseCard(s, team, card), `${team} can't use a ${card} now (one card a day)`);
  const t = s.teams[team];
  t.cards.splice(t.cards.indexOf(card), 1);
  t.cardUsedToday = true;
}

/** The first team to build on a card's plot takes the card. A plan is placed straight away. */
function takeCard(s: GameState, team: Team, id: PlotId): void {
  const plot = s.plots[id]!;
  if (!plot.card) return;
  s.teams[team].cardsTaken += 1;
  if (plot.card === 'plan') s.pending = { kind: 'plan', team };
  else s.teams[team].cards.push(plot.card);
  plot.card = null;
}

/** A plot changes owner through an auction or a plan. */
function changeOwner(s: GameState, id: PlotId, team: Team): void {
  const plot = s.plots[id]!;
  plot.owner = team;
  plot.since = s.day;
  plot.plan = null; // a plan goes away from a plot that is won
  plot.planShown = false;
  // An auction declared on it and not opened yet can't go ahead: it is cancelled and the bidder's move is lost.
  for (const a of s.auctions) {
    if (a.plot === id && a.day === s.day && a.status === 'declared') a.status = 'cancelled';
  }
}

function openAuctionById(s: GameState, id: number): Auction {
  const auction = s.auctions[id];
  rule(auction && auction.status === 'open', 'This auction is not open');
  return auction;
}

function noteContent(s: GameState, content: ChallengeContent): void {
  if (content.type === 'spelling') s.used.spelling.push(content.id);
  if (content.type === 'ordering') s.used.ordering.push(content.id);
  if (content.type === 'memory') {
    s.used[content.kind].push(...content.items);
    s.memoryCount += 1;
  }
}

function finishAuction(s: GameState, auction: Auction, winner: Team): void {
  auction.status = 'done';
  auction.winner = winner;
  if (winner === auction.bidder) {
    changeOwner(s, auction.plot, auction.bidder);
    const bidder = s.teams[auction.bidder];
    bidder.takenFrom.push(auction.defender);
    bidder.bidderWins += 1;
  } else {
    // The bidder only loses the move. If the plot carries the defender's plan, the plan fires.
    const plot = s.plots[auction.plot]!;
    if (plot.plan === auction.defender) {
      plot.planShown = true;
      if (planTargets(s, auction.bidder, auction.plot).length > 0) {
        s.pending = { kind: 'planTake', team: auction.defender, from: auction.bidder, plot: auction.plot };
      }
    }
  }
  settleAuctions(s);
}

function apply(s: GameState, e: GameEvent): void {
  switch (e.type) {
    case 'game/start':
      rule(s.step === 'setup', 'The competition has already started');
      startDay(s);
      return;

    case 'numbers/show': {
      rule(s.step === 'question' && s.question.kind === 'individual', 'Numbers come before an individual question');
      rule(!s.question.numbers, 'The numbers are already shown');
      const numbers = {} as Record<Team, number>;
      for (const team of TEAMS) {
        const t = s.teams[team];
        numbers[team] = t.questionCounter;
        t.questionCounter = nextPlayer(t.questionCounter, s.setup.teams[team].players);
      }
      s.question.numbers = numbers;
      return;
    }

    case 'question/show':
      rule(s.step === 'question', 'There is no question to show now');
      rule(s.question.index !== null, 'No questions left in the file');
      rule(s.question.kind === 'group' || s.question.numbers, 'Show the numbers first');
      s.step = 'asking';
      s.timer = { kind: 'question', startedAt: e.at };
      return;

    case 'question/replace':
      // The next question takes its place, with the same kind and numbers.
      rule(s.step === 'question' || s.step === 'asking', 'There is no question to replace');
      rule(s.nextQuestion < s.setup.questions.length, 'No questions left to replace it with');
      s.question.index = takeQuestion(s);
      if (s.step === 'asking') s.timer = { kind: 'question', startedAt: e.at };
      return;

    case 'answer/show':
      rule(s.step === 'asking', 'The question is not on screen');
      s.step = 'answer';
      s.timer = null;
      return;

    case 'timer/end': {
      // The question timer shows the answer; the challenge timer stops the challenge and shows its answer.
      if (s.step === 'asking') {
        s.step = 'answer';
        s.timer = null;
        return;
      }
      const auction = openAuction(s);
      const challenge = auction && currentChallenge(auction);
      rule(challenge && !challenge.stopped && s.timer?.kind === 'challenge', 'No timer is running');
      challenge.stopped = true;
      s.timer = null;
      return;
    }

    case 'permits/set':
      rule(s.step === 'answer', 'Permits come after the answer');
      rule(
        e.teams.every((team) => TEAMS.includes(team)),
        'Unknown team',
      );
      s.permits = TEAMS.filter((team) => e.teams.includes(team));
      s.order = buildOrder(s);
      for (const team of TEAMS) s.teams[team].moves = s.permits.includes(team) ? 1 : 0;
      s.step = 'build';
      s.turnIndex = 0;
      settleTurn(s);
      return;

    case 'build': {
      myTurn(s, e.team);
      const t = s.teams[e.team];
      rule(t.moves > 0, `${e.team} has no moves left`);
      if (e.via === 'bridge') {
        rule(canBridge(s, e.team, e.plot), 'A bridge needs an empty plot two steps from the team, in its row or column');
        spendCard(s, e.team, 'bridge');
      } else {
        rule(canBuild(s, e.team, e.plot), 'Build on an empty plot next to the team');
      }
      t.moves -= 1;
      t.moveCount += 1;
      const plot = s.plots[e.plot]!;
      plot.owner = e.team;
      plot.since = s.day;
      takeCard(s, e.team, e.plot);
      settleTurn(s);
      return;
    }

    case 'auction/declare': {
      myTurn(s, e.team);
      const t = s.teams[e.team];
      rule(t.moves > 0, `${e.team} has no moves left`);
      rule(canAuction(s, e.team, e.plot), 'This plot is not open to an auction');
      t.moves -= 1;
      t.moveCount += 1;
      const defender = s.plots[e.plot]!.owner!;
      const id = s.auctions.length;
      s.auctions.push({
        id,
        day: s.day,
        bidder: e.team,
        defender,
        plot: e.plot,
        status: 'declared',
        players: null,
        challenges: [],
        winner: null,
      });
      // A defender with a fence (and no card used today) is asked right away.
      if (canUseCard(s, defender, 'fence')) s.pending = { kind: 'fence', auction: id };
      settleTurn(s);
      return;
    }

    case 'card/fence':
    case 'fence/skip': {
      rule(s.pending?.kind === 'fence' && s.pending.auction === e.auction, 'No fence decision is waiting');
      if (e.type === 'card/fence') {
        // The auction is cancelled: the bidder's move is lost, no plan fires, and no player counter moves.
        const auction = s.auctions[e.auction]!;
        spendCard(s, auction.defender, 'fence');
        auction.status = 'fenced';
      }
      s.pending = null;
      settleTurn(s);
      return;
    }

    case 'card/crane':
      myTurn(s, e.team);
      spendCard(s, e.team, 'crane');
      s.teams[e.team].moves += 1;
      settleTurn(s);
      return;

    case 'turn/pass':
      // Only a team out of moves may pass (it decides not to use its crane). A team with a move must move.
      myTurn(s, e.team);
      rule(s.teams[e.team].moves === 0, 'A team with a move has to move');
      s.turnIndex += 1;
      settleTurn(s);
      return;

    case 'card/plan': {
      rule(s.pending?.kind === 'plan' && s.pending.team === e.team, 'No plan is waiting to be placed');
      const board = getBoard(s.setup.size);
      rule(e.plots[0] !== e.plots[1], 'A plan goes on two different plots');
      for (const id of e.plots) {
        const plot = s.plots[id];
        rule(
          plot && plot.owner === e.team && !board.plots[id]?.base && !plot.plan,
          "A plan goes on the team's own plots, not its base",
        );
      }
      for (const id of e.plots) s.plots[id]!.plan = e.team;
      s.pending = null;
      settleTurn(s);
      return;
    }

    case 'card/inspector':
      rule(s.step !== 'setup' && s.step !== 'announce' && !s.pending, 'The inspector is used during the days');
      rule(e.team !== e.target && TEAMS.includes(e.target), 'The inspector looks at another team');
      spendCard(s, e.team, 'inspector');
      s.inspections.push({ team: e.team, target: e.target, day: s.day });
      return;

    case 'auction/open': {
      rule(s.step === 'auctions' && !s.pending, 'Auctions open after building');
      rule(!openAuction(s), 'Finish the open auction first');
      const auction = nextAuction(s);
      rule(auction && auction.id === e.auction, 'Auctions open in the order they were declared');
      // Each side's player is the next from its bidder counter, kept for every challenge of this auction.
      const bidder = s.teams[auction.bidder];
      const defender = s.teams[auction.defender];
      auction.players = { bidder: bidder.bidderCounter, defender: defender.bidderCounter };
      bidder.bidderCounter = nextPlayer(bidder.bidderCounter, s.setup.teams[auction.bidder].players);
      defender.bidderCounter = nextPlayer(defender.bidderCounter, s.setup.teams[auction.defender].players);
      auction.status = 'open';
      return;
    }

    case 'challenge/start': {
      const auction = openAuctionById(s, e.auction);
      rule(!currentChallenge(auction), 'A challenge is already being played');
      auction.challenges.push({ content: e.content, startedAt: e.at, stopped: false, winner: null });
      noteContent(s, e.content);
      s.timer = { kind: 'challenge', startedAt: e.at };
      return;
    }

    case 'challenge/replay': {
      // A tied challenge is played again with new content of the same type.
      const auction = openAuctionById(s, e.auction);
      const challenge = currentChallenge(auction);
      rule(challenge, 'No challenge to replay');
      rule(e.content.type === challenge.content.type, 'A replay keeps the same challenge type');
      challenge.content = e.content;
      challenge.startedAt = e.at;
      challenge.stopped = false;
      noteContent(s, e.content);
      s.timer = { kind: 'challenge', startedAt: e.at };
      return;
    }

    case 'challenge/result': {
      const auction = openAuctionById(s, e.auction);
      const challenge = currentChallenge(auction);
      rule(challenge, 'No challenge is being played');
      rule(e.winner === auction.bidder || e.winner === auction.defender, 'The winner is one of the two sides');
      challenge.winner = e.winner;
      s.timer = null;
      // The first side to win two challenges wins the auction.
      if (wins(auction, e.winner) === 2) finishAuction(s, auction, e.winner);
      return;
    }

    case 'plan/take': {
      const pending = s.pending;
      rule(pending?.kind === 'planTake' && pending.team === e.team, 'No plan is waiting to strike');
      rule(planTargets(s, pending.from, pending.plot).includes(e.plot), "Take a plot of the bidder's next to the plan, not a base");
      changeOwner(s, e.plot, e.team);
      s.teams[e.team].takenFrom.push(pending.from);
      s.pending = null;
      settleAuctions(s);
      return;
    }

    case 'day/end':
      rule(s.step === 'dayEnd', 'The day is not over');
      rule(s.day < s.days, 'This is the last day: extend or announce');
      startDay(s);
      return;

    case 'days/extend':
      rule(s.step === 'dayEnd' && s.day >= s.days, 'Extending comes at the end of the last day');
      rule(Number.isInteger(e.count) && e.count >= 1, 'Extend by at least one day');
      s.days += e.count;
      startDay(s);
      return;

    case 'game/end':
      rule(s.step === 'dayEnd', 'The competition ends at the end of a day');
      s.step = 'announce';
      s.announce = 0;
      return;

    case 'announce/next':
      rule(s.step === 'announce' && s.announce < announcement(s).length - 1, 'The announcement is over');
      s.announce += 1;
      return;

    default:
      throw new RuleError(`Unknown event: ${(e as { type: string }).type}`);
  }
}
