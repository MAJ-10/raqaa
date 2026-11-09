import logo from '../../assets/brand/logo-horizontal.svg';
import { announcement, ranking } from '../engine/missions.ts';
import { currentChallenge, currentQuestion, openAuction, population, populationHidden, wins } from '../engine/select.ts';
import { TEAMS, type GameEvent, type GameState } from '../engine/types.ts';
import { CHALLENGE_NAMES, MISSION_NAMES } from '../ui/names.ts';
import { formatNumber, toArabicDigits } from '../ui/number.ts';
import { TeamBadge } from '../ui/TeamBadge.tsx';
import { Timer } from '../ui/Timer.tsx';
import './display.css';
import { Stage } from './Stage.tsx';
import { useRefereeSnapshot } from './use-referee.ts';

// Phases 3–4: a plain view of the state. The real display states (D01–D21) come in Phase 5.
export function DisplayApp() {
  const snapshot = useRefereeSnapshot<GameState | null, GameEvent>();
  const state = snapshot?.state ?? null;

  return (
    <Stage>
      <div className="display-start">
        <img className="display-logo" src={logo} alt="رقعة" />
        {state ? (
          <ul className="display-teams" data-testid="display-teams">
            {TEAMS.map((team) => (
              <li key={team}>
                <TeamBadge team={team} name={state.setup.teams[team].name} size={48} />
                {state.step !== 'setup' && !populationHidden(state) ? (
                  <strong className="display-population">{formatNumber(population(state, team))}</strong>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {state && state.step !== 'setup' ? <PlainState state={state} /> : null}
      </div>
    </Stage>
  );
}

/** One line or two about the current step. Nothing shows before its time. */
function PlainState({ state }: { state: GameState }) {
  const names = state.setup.teams;
  const question = currentQuestion(state);
  const numbers = state.question.numbers;

  switch (state.step) {
    case 'question':
    case 'asking':
    case 'answer':
      return (
        <div className="display-plain" data-testid="display-plain">
          {numbers ? (
            <p className="display-numbers">
              {TEAMS.map((team) => `${names[team].name}: ${formatNumber(numbers[team])}`).join('   ')}
            </p>
          ) : null}
          {state.step !== 'question' ? (
            <p className="display-question">{question ? toArabicDigits(question.text) : 'سؤال من الحكم'}</p>
          ) : null}
          {state.step === 'asking' && state.timer ? <Timer startedAt={state.timer.startedAt} size={96} /> : null}
          {state.step === 'answer' && question ? (
            <p className="display-answer">{toArabicDigits(question.answer)}</p>
          ) : null}
        </div>
      );
    case 'build':
      return (
        <p className="display-plain" data-testid="display-plain">
          {state.turn ? `دوره: ${names[state.turn].name}` : ''}
        </p>
      );
    case 'auctions': {
      const auction = openAuction(state);
      if (!auction) return <p className="display-plain" data-testid="display-plain">المزادات</p>;
      const challenge = currentChallenge(auction);
      return (
        <div className="display-plain" data-testid="display-plain">
          <p>
            {names[auction.bidder].name} {formatNumber(wins(auction, auction.bidder))} – {formatNumber(wins(auction, auction.defender))}{' '}
            {names[auction.defender].name}
          </p>
          {challenge ? <p>{CHALLENGE_NAMES[challenge.content.type]}</p> : null}
          {state.timer ? <Timer startedAt={state.timer.startedAt} size={96} /> : null}
        </div>
      );
    }
    case 'dayEnd':
      return (
        <p className="display-plain" data-testid="display-plain">
          نهاية اليوم {formatNumber(state.day)}
        </p>
      );
    case 'announce': {
      const step = announcement(state)[state.announce];
      if (!step || step.kind === 'population') return <p className="display-plain">سكان الخريطة</p>;
      if (step.kind === 'mission') {
        return (
          <p className="display-plain">
            {names[step.team].name}: {MISSION_NAMES[step.result.mission]} {step.result.done ? 'نجح' : 'فشل'}
          </p>
        );
      }
      const first = ranking(state).filter((row) => row.rank === 1);
      return <p className="display-plain">عمدة الرقعة: {first.map((row) => names[row.team].name).join('، ')}</p>;
    }
    default:
      return null;
  }
}
