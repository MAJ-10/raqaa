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
import { AuctionWindow } from './AuctionWindow.tsx';
import type { DisplayWindow, Running } from './windows.ts';

/** The window over the dimmed game, as the moment asks. */
export function GameWindow({ state, shown }: { state: GameState; shown: DisplayWindow }) {
  switch (shown.kind) {
    case 'numbers':
      return <NumbersWindow state={state} numbers={shown.numbers} />;
    case 'question':
      return <QuestionWindow text={shown.text} timer={shown.timer} />;
    case 'answer':
      return <AnswerWindow state={state} {...shown} />;
    case 'auction':
      return <AuctionWindow state={state} auction={shown.auction} challenge={shown.challenge} timer={shown.timer} />;
    case 'card':
      return <CardWindow state={state} {...shown} />;
    case 'mission':
      return <MissionWindow state={state} team={shown.team} result={shown.result} />;
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

type CardProps = { state: GameState; card: Card; team: Team; says: string };

/** D09 and D10: the card itself, large over the game, and under it the team and what it did. */
function CardWindow({ state, card, team, says }: CardProps) {
  return (
    <section className="card-window" data-window="card" aria-label={CARD_NAMES[card]}>
      <div className="big-card">
        <CardArt card={card} />
        <span className="big-card-name">{CARD_NAMES[card]}</span>
      </div>
      <p className="card-caption">
        <TeamName team={team} name={state.setup.teams[team].name} /> {says}
      </p>
    </section>
  );
}

/** D20: one secret mission in the announcement: its picture, the team, what it asked, and the result. */
function MissionWindow({ state, team, result }: { state: GameState; team: Team; result: MissionResult }) {
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
        <p className="mission-result" data-done={result.done || undefined}>
          <Icon name={result.done ? 'check' : 'x'} size={30} />
          <b>{formatNumber(result.points * 100, { sign: true })}</b>
        </p>
      </div>
    </section>
  );
}
