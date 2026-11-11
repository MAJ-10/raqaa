// Which sounds a moment makes on the display, worked out from the state and the event that just happened.
// Pure, so the tests can check it; DisplayApp plays them.
import { getBoard } from '../engine/board.ts';
import { announcement } from '../engine/missions.ts';
import type { GameEvent, GameState } from '../engine/types.ts';
import type { Sound } from './sound.ts';
import { CARD_FLIP, JUMP_DRAW, waitOf } from './windows.ts';

/** A sound, and how many seconds after the event it plays (to land with its motion). */
type Cue = { sound: Sound; after: number };

/** How long a building takes to land, so its thud comes with it. */
const LANDING = 0.28;

/** The swish of a card turning over in its window, which comes `wait` ms after the event. */
const flip = (wait: number): Cue => ({ sound: 'swish', after: (wait + CARD_FLIP) / 1000 });

export function cuesFor(state: GameState, e: GameEvent): Cue[] {
  const now = (sound: Sound): Cue => ({ sound, after: 0 });
  switch (e.type) {
    case 'question/show':
    case 'question/outside':
    case 'challenge/start':
    case 'challenge/replay':
    case 'game/end':
      return [now('whoosh')];
    case 'numbers/show':
    case 'answer/show':
    case 'permits/set':
      return [now('click')];
    case 'timer/end':
      return [now('timeUp')];
    case 'build': {
      const card = getBoard(state.setup.size).plots[e.plot]?.card;
      // With the bridge, the line jumps first and the building lands where it arrives. A card (taken, or the
      // bridge used) then turns over in its window.
      const lands = (e.via === 'bridge' ? JUMP_DRAW / 1000 : 0) + LANDING;
      return [
        ...(e.via === 'bridge' ? [now('swoosh')] : []),
        { sound: 'thud', after: lands },
        ...(card || e.via === 'bridge' ? [flip(waitOf(e))] : []),
      ];
    }
    case 'auction/declare':
      return [now('knock')];
    case 'card/fence':
    case 'card/crane':
    case 'card/inspector':
      return [flip(0)];
    case 'challenge/result':
      return [now(state.auctions[e.auction]?.status === 'done' ? 'gavel' : 'pop')];
    case 'plan/take':
      return [{ sound: 'thud', after: LANDING }, flip(0)];
    case 'announce/next': {
      // A mission's result; the podium times its own sounds with its towers.
      const step = announcement(state)[state.announce];
      return step?.kind === 'mission' ? [{ sound: step.result.done ? 'pop' : 'thud', after: 0.35 }] : [];
    }
    default:
      return [];
  }
}
