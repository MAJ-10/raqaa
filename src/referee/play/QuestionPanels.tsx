import { useEffect, useState } from 'react';
import { canChooseKind, currentQuestion, questionsLeft, timerSeconds } from '../../engine/select.ts';
import { TEAMS, type EventInput, type GameState, type QuestionKind, type Team } from '../../engine/types.ts';
import { Button } from '../../ui/Button.tsx';
import { Segmented } from '../../ui/fields.tsx';
import { reducedMotion } from '../../ui/motion.ts';
import { countOf, KIND_NAMES, QUESTION_NOUN } from '../../ui/names.ts';
import { formatNumber, toArabicDigits } from '../../ui/number.ts';
import { TeamTile, TeamTileButton } from '../../ui/TeamTile.tsx';
import { Timer } from '../../ui/Timer.tsx';

type Props = { state: GameState; act: (event: EventInput) => void };

const KINDS = (['individual', 'group'] as const).map((value: QuestionKind) => ({ value, label: KIND_NAMES[value] }));

/**
 * R03–R04: individual or group (the referee chooses, until the numbers or the question are shown), then
 * the question and its answer for the referee. An individual question shows the players' numbers first,
 * and has no timer; a group question shows straight away, with its timer. The question stays out of
 * sight until the kind is chosen.
 */
export function RequestBody({ state, act }: Props) {
  const { question, step } = state;
  const shown = currentQuestion(state);
  const left = questionsLeft(state);
  const fromFile = question.index !== null;
  const chosen = question.kind !== null;
  const numbersFirst = question.kind === 'individual' && !question.numbers;
  const seconds = timerSeconds(state);

  return (
    <>
      {canChooseKind(state) ? (
        <Segmented
          label="نوع السؤال"
          options={KINDS}
          value={question.kind}
          onChange={(kind) => act({ type: 'question/kind', kind })}
        />
      ) : null}
      {question.numbers ? (
        <ul className="numbers-grid" aria-label="أرقام اللاعبين">
          {TEAMS.map((team, i) => (
            <li key={team} aria-label={`${state.setup.teams[team].name}: رقم ${formatNumber(question.numbers![team])}`}>
              <TeamTile
                team={team}
                height={60}
                mark={<RollingNumber value={question.numbers![team]} most={state.setup.teams[team].players} order={i} />}
              >
                <span className="team-tile-name">{state.setup.teams[team].name}</span>
              </TeamTile>
            </li>
          ))}
        </ul>
      ) : null}

      {chosen ? (
        <div className="question">
          <div className="question-top">
            <p className="question-text">
              {shown ? toArabicDigits(shown.text) : question.outside ? 'سؤال من خارج الملف' : 'انتهت أسئلة الملف'}
            </p>
            {state.timer && seconds ? <Timer startedAt={state.timer.startedAt} seconds={seconds} size={48} /> : null}
          </div>
          {shown ? (
            <p className="question-answer">
              الإجابة: <strong>{toArabicDigits(shown.answer)}</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      {!chosen || step === 'answer' ? null : (
        <div className="step-actions">
          {step === 'question' && numbersFirst ? (
            <Button variant="primary" onClick={() => act({ type: 'numbers/show' })}>
              عرض الأرقام
            </Button>
          ) : null}
          {step === 'question' && !numbersFirst ? (
            <Button variant="primary" onClick={() => act({ type: fromFile ? 'question/show' : 'question/outside' })}>
              {fromFile ? 'عرض السؤال' : 'سؤال من خارج الملف'}
            </Button>
          ) : null}
          {step === 'asking' ? (
            <Button variant="primary" onClick={() => act({ type: 'answer/show' })}>
              عرض الإجابة
            </Button>
          ) : null}
          {fromFile && left > 0 && !numbersFirst ? (
            <Button icon="swap" onClick={() => act({ type: 'question/replace' })}>
              تبديل
            </Button>
          ) : null}
        </div>
      )}
      {chosen && fromFile && left <= 5 ? <p className="note">بقي في الملف {countOf(left, QUESTION_NOUN)}</p> : null}
    </>
  );
}

/**
 * A player's number that rolls through the team's numbers before it lands, one team after the other,
 * the moment the numbers are shown. Under reduced motion it shows straight away.
 */
function RollingNumber({ value, most, order }: { value: number; most: number; order: number }) {
  const first = 1 + ((value + order) % Math.max(1, most));
  const still = reducedMotion();
  const [shown, setShown] = useState(first);
  useEffect(() => {
    if (still) return;
    let n = first;
    const roll = setInterval(() => {
      n = (n % Math.max(1, most)) + 1;
      setShown(n);
    }, 60);
    const land = setTimeout(() => {
      clearInterval(roll);
      setShown(value);
    }, 520 + order * 140);
    return () => {
      clearInterval(roll);
      clearTimeout(land);
    };
  }, [value, first, most, order, still]);
  return <span className="team-tile-number">{formatNumber(still ? value : shown)}</span>;
}

/**
 * R05: once the answer is shown, the referee marks the teams that answered right and confirms. An
 * individual question gives one permit, to the fastest right answer. Until then the permits wait, dimmed.
 * A team that earns its permit is filled with its colour.
 */
export function PermitsBody({ state, act }: Props) {
  const [right, setRight] = useState<Team[]>([]);
  const single = state.question.kind === 'individual';
  const marking = state.step === 'answer';
  const toggle = (team: Team) =>
    setRight((now) => (now.includes(team) ? now.filter((t) => t !== team) : single ? [team] : [...now, team]));

  return (
    <>
      <div className="permit-grid">
        {TEAMS.map((team) => (
          <TeamTileButton
            key={team}
            team={team}
            className="permit"
            filled={right.includes(team)}
            aria-pressed={right.includes(team)}
            disabled={!marking}
            onClick={() => toggle(team)}
          >
            <span className="team-tile-name">{state.setup.teams[team].name}</span>
          </TeamTileButton>
        ))}
      </div>
      <div className="step-actions">
        <Button variant="primary" disabled={!marking} onClick={() => act({ type: 'permits/set', teams: right })}>
          تأكيد التصاريح
        </Button>
      </div>
    </>
  );
}
