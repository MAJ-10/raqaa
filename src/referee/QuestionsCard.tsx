import { useRef, useState } from 'react';
import type { Question, QuestionSource } from '../engine/types.ts';
// The Excel reader is large, and only the setup needs it, so it loads when it's first used.
const reader = () => import('../questions/read-file.ts');
import { Button } from '../ui/Button.tsx';
import { Icon } from '../ui/Icon.tsx';
import { countOf, QUESTION_NOUN } from '../ui/names.ts';
import { toArabicDigits } from '../ui/number.ts';

type Props = {
  questions: Question[];
  source: QuestionSource | null | undefined;
  onLoad: (questions: Question[], source: QuestionSource) => void;
};

/** The questions file: upload, its name and count, the first two questions, and the empty template. */
export function QuestionsCard({ questions, source, onLoad }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(file: File | undefined) {
    if (!file) return;
    try {
      const result = await (await reader()).readQuestionsFile(file);
      if (result.ok) {
        setError(null);
        onLoad(result.questions, { kind: 'file', name: file.name });
      } else {
        setError(result.error);
      }
    } catch {
      // For example a OneDrive file that is only online and can't be opened right now.
      setError('تعذّر فتح الملف. تأكّد أنه موجود على الجهاز، ثم حاول مرة أخرى.');
    } finally {
      if (input.current) input.current.value = '';
    }
  }

  return (
    <section className="card questions-card">
      <h2 className="card-title">الأسئلة</h2>
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xls,.csv"
        hidden
        data-testid="questions-file"
        onChange={(e) => load(e.target.files?.[0])}
      />
      {questions.length > 0 ? (
        <div className="questions-loaded">
          <span className="questions-ok">
            <Icon name="check" />
          </span>
          <span className="questions-file">
            <strong>{source?.name}</strong>
            <span>{countOf(questions.length, QUESTION_NOUN)}</span>
          </span>
          <button type="button" className="link-button" onClick={() => input.current?.click()}>
            تغيير
          </button>
        </div>
      ) : (
        <Button className="questions-upload" icon="plus" onClick={() => input.current?.click()}>
          رفع ملف الأسئلة
        </Button>
      )}
      {error ? (
        <p className="questions-error" role="alert">
          {error}
        </p>
      ) : null}
      {questions.length > 0 ? (
        <dl className="questions-preview">
          {questions.slice(0, 2).map((q, i) => (
            <div key={i}>
              <dt>{toArabicDigits(q.text)}</dt>
              <dd>{toArabicDigits(q.answer)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <button type="button" className="link-button" onClick={async () => (await reader()).downloadTemplate()}>
        تنزيل القالب
      </button>
    </section>
  );
}
