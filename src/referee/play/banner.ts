// Which moments get a banner over the map, and what it says.
import { getBoard } from '../../engine/board.ts';
import type { Card, GameEvent, GameState, Team } from '../../engine/types.ts';
import { CARD_NAMES } from '../../ui/names.ts';

/** How long a banner stays, from the moment of its event. */
export const BANNER_TIME = 2600;

export type Banner = {
  at: number;
  team: Team;
  /** The picture: an action card, or an icon on the team's colour. */
  card?: Card;
  icon?: string;
  /** The team's name in bold, then what it did. */
  text: string;
  /** A second, quieter line. */
  more?: string;
};

/**
 * The moment the last event deserves a banner over the map, so the screen answers what just happened:
 * an auction won or declared, a fence, a card taken or used, a bridge, the inspector. Only just now:
 * a window that reopens later doesn't show it again.
 */
export function bannerFor(state: GameState, events: readonly GameEvent[]): Banner | null {
  const e = events.at(-1);
  if (!e || Date.now() - e.at > BANNER_TIME) return null;
  const at = e.at;
  switch (e.type) {
    case 'challenge/result': {
      const auction = state.auctions[e.auction];
      if (auction?.status !== 'done' || !auction.winner) return null;
      const fired = state.pending?.kind === 'planTake' && state.pending.team === auction.winner;
      return { at, team: auction.winner, icon: 'crown', text: 'فاز بالمزاد', more: fired ? 'واشتغل مخططه السري' : undefined };
    }
    case 'auction/declare': {
      const defender = state.plots[e.plot]?.owner;
      if (!defender) return null;
      return { at, team: e.team, icon: 'gavel', text: `يزايد على أرض ${state.setup.teams[defender].name}` };
    }
    case 'card/fence': {
      const auction = state.auctions[e.auction];
      return auction ? { at, team: auction.defender, card: 'fence', text: 'استخدم السياج', more: 'وأُلغي المزاد' } : null;
    }
    case 'card/crane':
      return { at, team: e.team, card: 'crane', text: 'استخدم الرافعة', more: 'حركة إضافية' };
    case 'card/inspector':
      return { at, team: e.team, card: 'inspector', text: `كشف مشاريع ${state.setup.teams[e.target].name}` };
    case 'build': {
      const card = getBoard(state.setup.size).plots[e.plot]?.card;
      if (card) return { at, team: e.team, card, text: `أخذ ${CARD_NAMES[card]}` };
      if (e.via === 'bridge') return { at, team: e.team, card: 'bridge', text: 'بنى بالجسر' };
      return null;
    }
    default:
      return null;
  }
}
