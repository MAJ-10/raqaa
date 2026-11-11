// A competition that plays itself. `offered` lists what the referee screen offers at a moment (the same
// selectors the screen uses), sampled at random where a choice has many forms; the random games test plays
// thousands of moves through it. `demoNext` picks from it the way a referee showing the game would.
import { getBoard, neighbours } from './board.ts';
import { makeContent, newChallenge, type Banks, type Random } from './content.ts';
import { announcement } from './missions.ts';
import { canUseCard, currentChallenge, nextAuction, openAuction, options, planPlots, planTargets, questionsLeft } from './select.ts';
import { TEAMS, type EventInput, type GameState, type Team } from './types.ts';

/** A small seeded random generator (mulberry32), so a game can be played again. */
export function seeded(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const any = <T>(list: readonly T[], random: Random): T => list[Math.floor(random() * list.length)]!;

/** What the referee screen offers now, apart from ending early. Challenges draw their content from the banks. */
export function offered(s: GameState, random: Random, banks: Banks): EventInput[] {
  const list: EventInput[] = [];
  const q = s.question;
  switch (s.step) {
    case 'setup':
      list.push({ type: 'game/start' });
      break;
    case 'question': {
      // The referee chooses the kind (group more often, so more teams build), and sometimes changes it.
      if (q.kind === null) {
        list.push({ type: 'question/kind', kind: random() < 0.7 ? 'group' : 'individual' });
        break;
      }
      if (!q.numbers && random() < 0.2) list.push({ type: 'question/kind', kind: q.kind === 'group' ? 'individual' : 'group' });
      if (q.kind === 'individual' && !q.numbers) list.push({ type: 'numbers/show' });
      if (q.kind === 'group' || q.numbers) list.push({ type: q.index !== null ? 'question/show' : 'question/outside' });
      if (q.index !== null && questionsLeft(s) > 0) list.push({ type: 'question/replace' });
      break;
    }
    case 'asking':
      list.push({ type: 'answer/show' });
      if (s.timer) list.push({ type: 'timer/end' }); // a group question; an individual one has no timer
      if (q.index !== null && questionsLeft(s) > 0) list.push({ type: 'question/replace' });
      break;
    case 'answer': {
      const right = TEAMS.filter(() => random() < 0.7);
      list.push({ type: 'permits/set', teams: q.kind === 'individual' ? right.slice(0, 1) : right });
      break;
    }
    case 'build': {
      const pending = s.pending;
      if (pending?.kind === 'fence') {
        list.push({ type: 'card/fence', auction: pending.auction }, { type: 'fence/skip', auction: pending.auction });
      } else if (pending?.kind === 'inspector') {
        // The inspector is used as soon as it is taken: the referee picks whose missions to show.
        for (const target of TEAMS.filter((t) => t !== pending.team)) {
          list.push({ type: 'card/inspector', team: pending.team, target });
        }
      } else if (pending?.kind === 'plan') {
        const own = planPlots(s, pending.team);
        if (own.length >= 2) {
          // Mostly on plots that touch another team, where bids come, so plans fire in the games.
          const board = getBoard(s.setup.size);
          const border = own.filter((id) =>
            neighbours(board, id).some((near) => ![null, pending.team].includes(s.plots[near]?.owner ?? null)),
          );
          const from = border.length >= 2 && random() < 0.8 ? border : own;
          const first = any(from, random);
          const second = any(
            from.filter((id) => id !== first),
            random,
          );
          list.push({ type: 'card/plan', team: pending.team, plots: [first, second] });
        }
      } else if (s.turn) {
        const team = s.turn;
        if (s.teams[team].moves > 0) {
          // Every allowed plot, but leaning towards auctions (and plots with a plan) so the games reach them.
          const o = options(s, team);
          const planned = o.auction.filter((id) => s.plots[id]?.plan);
          const auctions = planned.length > 0 && random() < 0.6 ? planned : o.auction;
          if (auctions.length > 0 && random() < 0.6) {
            for (const plot of auctions) list.push({ type: 'auction/declare', team, plot });
            break;
          }
          for (const plot of o.build) list.push({ type: 'build', team, plot });
          for (const plot of o.auction) list.push({ type: 'auction/declare', team, plot });
          for (const plot of o.bridge) list.push({ type: 'build', team, plot, via: 'bridge' });
        } else {
          list.push({ type: 'turn/pass', team });
        }
        if (canUseCard(s, team, 'crane')) list.push({ type: 'card/crane', team });
      }
      break;
    }
    case 'auctions': {
      const pending = s.pending;
      if (pending?.kind === 'planTake') {
        for (const plot of planTargets(s, pending.from, pending.plot)) list.push({ type: 'plan/take', team: pending.team, plot });
        break;
      }
      const open = openAuction(s);
      const next = nextAuction(s);
      if (open) {
        const challenge = currentChallenge(open);
        if (!challenge) {
          list.push({ type: 'challenge/start', auction: open.id, content: newChallenge(s, banks, random).content });
        } else if (s.plots[open.plot]?.plan && random() < 0.7) {
          // A bid on a plan plot: lean towards the defender, so plans fire in the games.
          list.push({ type: 'challenge/result', auction: open.id, winner: open.defender });
        } else {
          for (const winner of [open.bidder, open.defender]) list.push({ type: 'challenge/result', auction: open.id, winner });
          list.push({
            type: 'challenge/replay',
            auction: open.id,
            content: makeContent(s, challenge.content.type, banks, random).content,
          });
          if (s.timer?.kind === 'challenge' && !challenge.stopped) list.push({ type: 'timer/end' });
        }
      } else if (next) {
        list.push({ type: 'auction/open', auction: next.id });
      }
      break;
    }
    case 'dayEnd':
      if (s.day < s.days) list.push({ type: 'day/end' });
      else list.push(s.days < 24 && random() < 0.3 ? { type: 'days/extend', count: 1 + Math.floor(random() * 3) } : { type: 'game/end' });
      break;
    case 'announce':
      if (s.announce < announcement(s).length - 1) list.push({ type: 'announce/next' });
      break;
  }
  return list;
}

/**
 * The next move of a demo competition, or null at the end of the announcement. It plays the game at its
 * liveliest, so a short demo shows it all: most questions go to every team and most teams answer right,
 * and the teams build towards each other, so they meet, take cards and bid. Out of what the screen offers,
 * it keeps what shows the game: the question stays as chosen and runs its course, the competition ends
 * on its last day, and a tie comes now and then. It never takes a plan that would have nowhere to go.
 */
export function demoNext(s: GameState, random: Random, banks: Banks): EventInput | null {
  if (s.step === 'dayEnd' && s.day >= s.days) return { type: 'game/end' };
  if (s.step === 'question' && s.question.kind === null) return { type: 'question/kind', kind: random() < 0.8 ? 'group' : 'individual' };
  if (s.step === 'answer') {
    const right = s.question.kind === 'individual' ? [any(TEAMS, random)] : TEAMS.filter(() => random() < 0.9);
    return { type: 'permits/set', teams: right };
  }
  const board = getBoard(s.setup.size);
  const keep = (e: EventInput): boolean => {
    switch (e.type) {
      case 'question/kind':
        return s.question.kind === null;
      case 'question/replace':
      case 'timer/end':
        return false;
      case 'challenge/replay':
        return random() < 0.15;
      case 'build':
        // A plan needs two of the team's plots: the one it takes, and another.
        return board.plots[e.plot]?.card !== 'plan' || planPlots(s, e.team).length >= 1;
      default:
        return true;
    }
  };
  const choices = offered(s, random, banks).filter(keep);
  const bridges = choices.filter((e) => e.type === 'build' && e.via);
  if (bridges.length > 0 && random() < 0.5) return any(bridges, random);
  const builds = choices.filter((e) => e.type === 'build' && !e.via);
  const cards = builds.filter((e) => e.type === 'build' && board.plots[e.plot]?.card);
  if (cards.length > 0 && random() < 0.6) return any(cards, random);
  if (builds.length > 1 && random() < 0.75) return any(towardsOthers(s, builds), random);
  return choices.length > 0 ? any(choices, random) : null;
}

/** Of these builds, the ones that bring the team nearest to another team's plots. */
function towardsOthers(s: GameState, builds: EventInput[]): EventInput[] {
  const board = getBoard(s.setup.size);
  const theirs = (team: Team) => board.ids.filter((id) => ![null, team].includes(s.plots[id]?.owner ?? null));
  const distance = (e: EventInput): number => {
    if (e.type !== 'build') return Infinity;
    const at = board.plots[e.plot]!;
    return Math.min(...theirs(e.team).map((id) => Math.abs(board.plots[id]!.row - at.row) + Math.abs(board.plots[id]!.col - at.col)));
  };
  const nearest = Math.min(...builds.map(distance));
  return builds.filter((e) => distance(e) === nearest);
}
