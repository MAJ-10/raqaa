import { useLayoutEffect, useRef } from 'react';
import tokens from '../../assets/tokens.json';
import type { Card, GameState, Team } from '../engine/types.ts';
import { CardArt } from '../ui/CardArt.tsx';
import { CARD_NAMES } from '../ui/names.ts';
import { TeamName } from '../ui/TeamBadge.tsx';
import { motion } from '../ui/motion.ts';
import { AuctionWindow } from './AuctionWindow.tsx';
import { QuestionCard } from './QuestionCard.tsx';
import { CARD_FLIP, type DisplayWindow } from './windows.ts';

/** The window over the dimmed game, as the moment asks. A mission shows beside the map instead (MissionStrip). */
export function GameWindow({ state, shown, live }: { state: GameState; shown: DisplayWindow; live: boolean }) {
  switch (shown.kind) {
    case 'numbers':
    case 'question':
    case 'answer':
      return <QuestionCard state={state} shown={shown} live={live} />;
    case 'auction':
      return <AuctionWindow state={state} auction={shown.auction} challenge={shown.challenge} timer={shown.timer} live={live} />;
    case 'card':
      return <CardWindow state={state} {...shown} live={live} />;
    case 'mission':
      return null;
  }
}

type CardProps = { state: GameState; card: Card; team: Team; says: string; until: number; taken: boolean; live: boolean };

/** Where each team's board hangs, from the middle of the big card: a card taken flies there. */
const BOARD_FROM_CARD: Record<string, [number, number]> = {
  'top-left': [201 - 640, 145 - 308],
  'top-right': [1079 - 640, 145 - 308],
  'bottom-left': [201 - 640, 653 - 308],
  'bottom-right': [1079 - 640, 653 - 308],
};

/**
 * How long a card takes to come in face down, to turn over once its back has shown (CARD_FLIP after it
 * came), and to leave at the end of its moment.
 */
const CARD_IN = 600;
const CARD_TURN = 800;
const CARD_EXIT = 560;

/** The back of every action card, as the identity draws it: a small map in the teams' colours, the tower white. */
const CARD_BACK = [
  ['blue', 'blue', 'night-city', 'coral', 'coral'],
  ['blue', 'night-city', 'night-city', 'night-city', 'coral'],
  ['night-city', 'night-city', 'white', 'night-city', 'night-city'],
  ['gold', 'night-city', 'night-city', 'night-city', 'green'],
  ['gold', 'gold', 'night-city', 'green', 'green'],
].flat();

/**
 * D09 and D10: the card itself, large over the game, and under it the team and what it did. As the
 * identity's cards do, it comes in face down and shows its back a while, then turns over slowly. At the
 * end of its moment a card taken flies to the team's board, and a card used turns face down and fades.
 * It moves itself in and out: the window around it doesn't.
 */
function CardWindow({ state, card, team, says, until, taken, live }: CardProps) {
  const box = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const node = box.current;
    if (!node || !live) return;
    // The holder comes and goes (fading would flatten the turn, so the card itself only turns).
    const hold = node.querySelector('.big-card-hold');
    const flip = node.querySelector('.big-card-flip');
    const caption = node.querySelector('.card-caption');
    motion(hold, [{ opacity: 0, transform: 'translateY(28px) scale(0.86)' }, { opacity: 1, transform: 'none' }], { duration: CARD_IN });
    // Even time across the whole timeline (an easing over it would cut the back's wait short); only the turn
    // itself eases.
    motion(
      flip,
      [
        { transform: 'rotateY(180deg)' },
        { transform: 'rotateY(180deg)', offset: CARD_FLIP / (CARD_FLIP + CARD_TURN), easing: 'cubic-bezier(0.45, 0, 0.25, 1)' },
        { transform: 'rotateY(0deg)' },
      ],
      { duration: CARD_FLIP + CARD_TURN, easing: 'linear' },
    );
    motion(caption, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: CARD_FLIP + CARD_TURN - 200, fill: 'backwards' });
    const leave = until - CARD_EXIT - Date.now();
    if (leave <= 0) return;
    const late = { duration: CARD_EXIT, delay: leave, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' } as const;
    if (taken) {
      const [dx, dy] = BOARD_FROM_CARD[tokens.teamCorner[team]] ?? [0, 0];
      motion(hold, [{ transform: 'none', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(0.16)`, opacity: 0.3 }], late);
    } else {
      motion(flip, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], { ...late, duration: CARD_EXIT * 0.75 });
      motion(hold, [{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0, transform: 'scale(0.9)' }], late);
    }
    motion(caption, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, delay: leave, fill: 'forwards' });
  }, [until, live, taken, team]);
  return (
    <section ref={box} className="card-window" data-window="card" aria-label={CARD_NAMES[card]}>
      <div className="big-card-hold">
        <div className="big-card-flip">
          <div className="big-card">
            <CardArt card={card} />
            <span className="big-card-name">{CARD_NAMES[card]}</span>
          </div>
          <div className="big-card big-card-back" aria-hidden="true">
            <span className="card-back-map">
              {CARD_BACK.map((colour, i) => (
                <i key={i} style={{ background: `var(--${colour})` }} />
              ))}
            </span>
          </div>
        </div>
      </div>
      <p className="card-caption">
        <TeamName team={team} name={state.setup.teams[team].name} /> {says}
      </p>
    </section>
  );
}
