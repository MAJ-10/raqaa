import { useState } from 'react';
import { currentQuestion, questionsLeft } from '../../engine/select.ts';
import { TEAMS, type EventInput, type GameState, type Team } from '../../engine/types.ts';
import { Button } from '../../ui/Button.tsx';
import { countOf, QUESTION_NOUN } from '../../ui/names.ts';
import { formatNumber, toArabicDigits } from '../../ui/number.ts';
import { TeamBadge, TeamSymbol } from '../../ui/TeamBadge.tsx';
import { Timer } from '../../ui/Timer.tsx';

type Props = { state: GameState; act: (event: EventInput) => void };

/** The question and its answer, for the referee only, above the panel. */
export function QuestionCard({ state }: { state: GameState }) {
  const question = currentQuestion(state);
  return (
    <section className="card question-card">
      {question ? (
        <>
          <p className="question-text">{toArabicDigits(question.text)}</p>
          <p className="question-answer">
            <span>الإجابة</span>
            <strong>{toArabicDigits(question.answer)}</strong>
          </p>
        </>
      ) : (
        <p className="question-text">{state.question.outside ? 'سؤال من خارج الملف' : 'خلصت أسئلة الملف'}</p>
      )}
    </section>
  );
}

/** R03–R04: numbers, then the question with its timer, then the answer. */
export function QuestionPanel({ state, act }: Props) {
  const { question, step } = state;
  const left = questionsLeft(state);
  const needNumbers = question.kind === 'individual' && !question.numbers;
  const fromFile = currentQuestion(state) !== null;

  return (
    <section className="card panel">
      <header className="panel-head">
        <h2>طلب البناء</h2>
        <span className="chip">{question.kind === 'individual' ? 'فردي' : 'جماعي'}</span>
        {state.timer ? <Timer startedAt={state.timer.startedAt} /> : null}
      </header>
      {left <= 5 ? <p className="panel-warning">باقي في الملف {countOf(left, QUESTION_NOUN)}</p> : null}
      {question.numbers ? (
        <div className="numbers-grid">
          {TEAMS.map((team) => (
            <span key={team} className="number-cell">
              <TeamSymbol team={team} size={26} />
              رقم {formatNumber(question.numbers![team])}
            </span>
          ))}
        </div>
      ) : null}
      <footer className="panel-actions">
        {step === 'question' && needNumbers ? (
          <Button variant="primary" onClick={() => act({ type: 'numbers/show' })}>
            عرض الأرقام
          </Button>
        ) : null}
        {step === 'question' && !needNumbers ? (
          <>
            {fromFile ? (
              <Button variant="primary" onClick={() => act({ type: 'question/show' })}>
                عرض السؤال
              </Button>
            ) : null}
            <Button onClick={() => act({ type: 'question/outside' })}>سؤال من خارج الملف</Button>
          </>
        ) : null}
        {step === 'asking' ? (
          <Button variant="primary" onClick={() => act({ type: 'answer/show' })}>
            عرض الإجابة
          </Button>
        ) : null}
        {(step === 'question' || step === 'asking') && left > 0 ? (
          <Button icon="swap" onClick={() => act({ type: 'question/replace' })}>
            تبديل
          </Button>
        ) : null}
      </footer>
    </section>
  );
}

/** R05: the referee marks the teams that answered right. */
export function PermitsPanel({ state, act }: Props) {
  const [right, setRight] = useState<Set<Team>>(new Set());
  const toggle = (team: Team) =>
    setRight((now) => {
      const next = new Set(now);
      if (next.has(team)) next.delete(team);
      else next.add(team);
      return next;
    });

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
            aria-pressed={right.has(team)}
            onClick={() => toggle(team)}
          >
            <TeamBadge team={team} name={state.setup.teams[team].name} size={30} />
          </button>
        ))}
      </div>
      <footer className="panel-actions">
        <Button variant="primary" onClick={() => act({ type: 'permits/set', teams: [...right] })}>
          تأكيد التصاريح
        </Button>
      </footer>
    </section>
  );
}
