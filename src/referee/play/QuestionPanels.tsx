import { useState } from 'react';
import { currentQuestion, questionsLeft } from '../../engine/select.ts';
import { TEAMS, type EventInput, type GameState, type QuestionKind, type Team } from '../../engine/types.ts';
import { Button } from '../../ui/Button.tsx';
import { Segmented } from '../../ui/fields.tsx';
import { countOf, QUESTION_NOUN } from '../../ui/names.ts';
import { formatNumber, toArabicDigits } from '../../ui/number.ts';
import { TeamBadge, TeamSymbol } from '../../ui/TeamBadge.tsx';
import { Timer } from '../../ui/Timer.tsx';

type Props = { state: GameState; act: (event: EventInput) => void };

const KINDS: { value: QuestionKind; label: string }[] = [
  { value: 'individual', label: 'فردي' },
  { value: 'group', label: 'جماعي' },
];

/** R03–R05: the build request, the question and the permits, one card under the other. */
export function RequestPanels(props: Props) {
  return (
    <>
      <RequestCard {...props} />
      <QuestionCard {...props} />
      <PermitsCard {...props} />
    </>
  );
}

/** The referee chooses individual or group; an individual question shows each team's player number first. */
function RequestCard({ state, act }: Props) {
  const { question, step } = state;
  return (
    <section className="card panel">
      <header className="panel-head">
        <h2>طلب البناء</h2>
        <Segmented
          label="نوع السؤال"
          options={KINDS}
          value={question.kind}
          disabled={step !== 'question' || question.numbers !== null}
          onChange={(kind) => act({ type: 'question/kind', kind })}
        />
      </header>
      {question.numbers ? (
        <div className="numbers-grid">
          {TEAMS.map((team) => (
            <span key={team} className="number-cell">
              <TeamSymbol team={team} size={26} />
              رقم {formatNumber(question.numbers![team])}
            </span>
          ))}
        </div>
      ) : question.kind === 'individual' ? (
        <footer className="panel-actions">
          <Button variant="primary" onClick={() => act({ type: 'numbers/show' })}>
            عرض الأرقام
          </Button>
        </footer>
      ) : null}
    </section>
  );
}

/** The question and its answer, for the referee only, then on screen when the referee shows it. */
function QuestionCard({ state, act }: Props) {
  const { question, step } = state;
  const shown = currentQuestion(state);
  const left = questionsLeft(state);
  const fromFile = question.index !== null;
  const ready = question.kind === 'group' || question.numbers !== null;

  return (
    <section className="card panel question-card">
      <div className="question-top">
        <p className="question-text">
          {shown ? toArabicDigits(shown.text) : question.outside ? 'سؤال من خارج الملف' : 'خلصت أسئلة الملف'}
        </p>
        {state.timer ? <Timer startedAt={state.timer.startedAt} /> : null}
      </div>
      {shown ? (
        <p className="question-answer">
          <span>الإجابة</span>
          <strong>{toArabicDigits(shown.answer)}</strong>
        </p>
      ) : null}
      {fromFile && left <= 5 ? <p className="panel-warning">باقي في الملف {countOf(left, QUESTION_NOUN)}</p> : null}
      {step === 'answer' ? null : (
        <footer className="panel-actions">
          {step === 'question' && fromFile ? (
            <Button variant="primary" disabled={!ready} onClick={() => act({ type: 'question/show' })}>
              عرض السؤال
            </Button>
          ) : null}
          {step === 'question' && !fromFile ? (
            <Button variant="primary" disabled={!ready} onClick={() => act({ type: 'question/outside' })}>
              سؤال من خارج الملف
            </Button>
          ) : null}
          {step === 'asking' ? (
            <Button variant="primary" onClick={() => act({ type: 'answer/show' })}>
              عرض الإجابة
            </Button>
          ) : null}
          {fromFile && left > 0 ? (
            <Button icon="swap" onClick={() => act({ type: 'question/replace' })}>
              تبديل
            </Button>
          ) : null}
        </footer>
      )}
    </section>
  );
}

/**
 * The referee marks the teams that answered right, from the moment the question is on screen. An
 * individual question gives one permit, to the fastest right answer. Confirmed once the answer is shown.
 */
function PermitsCard({ state, act }: Props) {
  const [right, setRight] = useState<Team[]>([]);
  const single = state.question.kind === 'individual';
  const marking = state.step === 'asking' || state.step === 'answer';
  const toggle = (team: Team) =>
    setRight((now) => (now.includes(team) ? now.filter((t) => t !== team) : single ? [team] : [...now, team]));

  return (
    <section className="card panel">
      <header className="panel-head">
        <h2>التصاريح</h2>
      </header>
      <div className="permit-grid">
        {TEAMS.map((team) => (
          <button
            key={team}
            type="button"
            className="permit"
            data-team={team}
            aria-pressed={right.includes(team)}
            disabled={!marking}
            onClick={() => toggle(team)}
          >
            <TeamBadge team={team} name={state.setup.teams[team].name} size={30} />
          </button>
        ))}
      </div>
      <footer className="panel-actions">
        <Button
          variant="primary"
          disabled={state.step !== 'answer'}
          onClick={() => act({ type: 'permits/set', teams: right })}
        >
          تأكيد التصاريح
        </Button>
      </footer>
    </section>
  );
}
