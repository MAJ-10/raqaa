import { useLayoutEffect, useRef } from 'react';
import tokens from '../../assets/tokens.json';
import { TEAMS, type Card, type GameState, type Team } from '../engine/types.ts';
import type { MissionResult } from '../engine/missions.ts';
import { CardArt } from '../ui/CardArt.tsx';
import { Icon } from '../ui/Icon.tsx';
import { MissionArt } from '../ui/MissionArt.tsx';
import { CARD_NAMES, MISSION_NAMES, MISSION_TEXT } from '../ui/names.ts';
import { formatNumber, toArabicDigits } from '../ui/number.ts';
import { TeamName } from '../ui/TeamBadge.tsx';
import { TeamTile } from '../ui/TeamTile.tsx';
import { Timer } from '../ui/Timer.tsx';
import { EASE_BOUNCE, motion } from '../ui/motion.ts';
import { AuctionWindow } from './AuctionWindow.tsx';
import type { DisplayWindow, Running } from './windows.ts';

/** The window over the dimmed game, as the moment asks. */
export function GameWindow({ state, shown, live }: { state: GameState; shown: DisplayWindow; live: boolean }) {
  switch (shown.kind) {
    case 'numbers':
      return <NumbersWindow state={state} numbers={shown.numbers} />;
    case 'question':
      return <QuestionWindow text={shown.text} timer={shown.timer} />;
    case 'answer':
      return <AnswerWindow state={state} {...shown} />;
    case 'auction':
      return <AuctionWindow state={state} auction={shown.auction} challenge={shown.challenge} timer={shown.timer} live={live} />;
    case 'card':
      return <CardWindow state={state} {...shown} live={live} />;
    case 'mission':
      return <MissionWindow state={state} team={shown.team} result={shown.result} live={live} />;
  }
}

/** «طلب بناء», the label every window of the day's question carries. */
function QuestionLabel() {
  return (
    <h2 className="window-label">
      <Icon name="question" size={30} />
      طلب بناء
    </h2>
  );
}

/** D02: each team's player for the individual question, like a shirt number on the team's colour. */
function NumbersWindow({ state, numbers }: { state: GameState; numbers: Record<Team, number> }) {
  return (
    <section className="display-window window-numbers" data-window="numbers" aria-label="أرقام طلب البناء">
      <QuestionLabel />
      {/* The teams sit as their boards do in the corners: coral and green on the right, blue and gold on the left. */}
      <div className="window-teams">
        {TEAMS.map((team) => (
          <TeamTile key={team} team={team} height={92} mark={<span className="team-tile-number">{formatNumber(numbers[team])}</span>}>
            <span className="team-tile-name">{state.setup.teams[team].name}</span>
          </TeamTile>
        ))}
      </div>
    </section>
  );
}

/** D03 and D04: the question, with its timer when it is a group question. No word of individual or group. */
function QuestionWindow({ text, timer }: { text: string | null; timer: Running | null }) {
  const words = text ? toArabicDigits(text) : 'سؤال من الحكم';
  return (
    <section className="display-window window-question" data-window="question" aria-label="طلب البناء">
      <header className="window-head">
        <QuestionLabel />
        {timer ? <Timer startedAt={timer.startedAt} seconds={timer.seconds} size={84} /> : null}
      </header>
      <p className="question-words" data-long={words.length > 90 || undefined}>
        {words}
      </p>
    </section>
  );
}

type AnswerProps = { state: GameState; answer: string | null; teams: Team[]; permits: Team[] | null; individual: boolean };

/**
 * D05: the answer, and the teams in build order. Once the permits are confirmed, a permit gets a green
 * frame and a tick; in a group question a wrong answer gets a red frame and a cross. In an individual
 * question only the fastest right answer takes the permit, so the others are left plain.
 */
function AnswerWindow({ state, answer, teams, permits, individual }: AnswerProps) {
  return (
    <section className="display-window window-answer" data-window="answer" aria-label="الإجابة">
      <h2 className="window-label">
        <Icon name="check" size={30} />
        الإجابة
      </h2>
      {answer !== null ? <p className="answer-box">{toArabicDigits(answer)}</p> : null}
      <div className="window-teams">
        {teams.map((team) => {
          const result = permits === null ? null : permits.includes(team) ? 'right' : individual ? null : 'wrong';
          return (
            <TeamTile
              key={team}
              team={team}
              height={68}
              className={result ? `answer-${result}` : undefined}
            >
              <span className="team-tile-name">{state.setup.teams[team].name}</span>
              {result ? <Icon name={result === 'right' ? 'check' : 'x'} size={30} className="answer-mark" /> : null}
            </TeamTile>
          );
        })}
      </div>
    </section>
  );
}

type CardProps = { state: GameState; card: Card; team: Team; says: string; until: number; taken: boolean; live: boolean };

/** Where each team's board hangs, from the middle of the big card: a card taken flies there. */
const BOARD_FROM_CARD: Record<string, [number, number]> = {
  'top-left': [201 - 640, 145 - 308],
  'top-right': [1079 - 640, 145 - 308],
  'bottom-left': [201 - 640, 653 - 308],
  'bottom-right': [1079 - 640, 653 - 308],
};

/** How long a card takes to leave, at the end of its moment, and to come in face down and turn over. */
const CARD_EXIT = 560;
const CARD_IN = 1050;

/** The back of every action card, as the identity draws it: a small map in the teams' colours, the tower white. */
const CARD_BACK = [
  ['blue', 'blue', 'night-city', 'coral', 'coral'],
  ['blue', 'night-city', 'night-city', 'night-city', 'coral'],
  ['night-city', 'night-city', 'white', 'night-city', 'night-city'],
  ['gold', 'night-city', 'night-city', 'night-city', 'green'],
  ['gold', 'gold', 'night-city', 'green', 'green'],
].flat();

/** D09 and D10: the card itself, large over the game, and under it the team and what it did. */
function CardWindow({ state, card, team, says, until, taken, live }: CardProps) {
  const box = useRef<HTMLElement>(null);
  // As the identity's cards do, it comes in face down, then turns over. At the end of its moment a card taken
  // flies to the team's board, and a card used turns face down again and fades.
  useLayoutEffect(() => {
    const node = box.current;
    if (!node || !live) return;
    // The holder comes and goes (fading would flatten the turn, so the card itself only turns).
    const hold = node.querySelector('.big-card-hold');
    const flip = node.querySelector('.big-card-flip');
    const caption = node.querySelector('.card-caption');
    motion(hold, [{ opacity: 0, transform: 'scale(0.55)' }, { opacity: 1, transform: 'none' }], { duration: CARD_IN * 0.42, easing: EASE_BOUNCE });
    motion(
      flip,
      [
        { transform: 'rotateY(180deg)' },
        { transform: 'rotateY(180deg)', offset: 0.55, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' },
        { transform: 'rotateY(0deg)' },
      ],
      { duration: CARD_IN },
    );
    motion(caption, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: CARD_IN - 150, fill: 'backwards' });
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

/** D20: one secret mission in the announcement: its picture, the team, what it asked, and the result. */
function MissionWindow({ state, team, result, live }: { state: GameState; team: Team; result: MissionResult; live: boolean }) {
  const mark = useRef<HTMLParagraphElement>(null);
  // The result comes a moment after the mission, with a pop.
  useLayoutEffect(() => {
    if (live) motion(mark.current, [{ opacity: 0, transform: 'scale(0.5)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 380, easing: EASE_BOUNCE, fill: 'backwards' });
  }, [live]);
  return (
    <section className="display-window window-mission" data-window="mission" aria-label="مشروع سري">
      <h2 className="window-label">
        <Icon name="envelope" size={30} />
        مشروع سري
      </h2>
      <div className="mission-row">
        <span className="mission-picture">
          <MissionArt mission={result.mission} team={team} />
        </span>
        <div className="mission-words">
          <TeamName team={team} name={state.setup.teams[team].name} />
          <p className="mission-title">
            {MISSION_NAMES[result.mission]}
            <small>{MISSION_TEXT[result.mission]}</small>
          </p>
        </div>
        <p ref={mark} className="mission-result" data-done={result.done || undefined}>
          <Icon name={result.done ? 'check' : 'x'} size={30} />
          <b>{formatNumber(result.points * 100, { sign: true })}</b>
        </p>
      </div>
    </section>
  );
}
