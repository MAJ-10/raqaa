import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { utils, write } from 'xlsx';
import { parseQuestions } from '../src/questions/read-file.ts';

const csv = (text: string) => new TextEncoder().encode(text);

function xlsx(rows: unknown[][]): Uint8Array {
  const book = utils.book_new();
  utils.book_append_sheet(book, utils.aoa_to_sheet(rows), 'الأسئلة');
  return new Uint8Array(write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

describe('reading the questions file', () => {
  it('reads the sample CSV (UTF-8 with BOM, Windows line ends)', () => {
    const result = parseQuestions(new Uint8Array(readFileSync(resolve('samples/questions-sample.csv'))));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions).toHaveLength(30);
    expect(result.questions[0]).toEqual({ text: 'كم عدد أضلاع الشكل السداسي؟', answer: '6' });
  });

  it('reads an Excel file, with the columns in any order and blank rows skipped', () => {
    const result = parseQuestions(
      xlsx([
        ['الإجابة', 'السؤال'],
        ['الرياض', 'ما عاصمة المملكة؟'],
        [],
        [7, 'كم يوماً في الأسبوع؟'],
      ]),
    );
    expect(result).toEqual({
      ok: true,
      questions: [
        { text: 'ما عاصمة المملكة؟', answer: 'الرياض' },
        { text: 'كم يوماً في الأسبوع؟', answer: '7' },
      ],
    });
  });

  it('accepts «الاجابة» without the hamza', () => {
    const result = parseQuestions(csv('السؤال,الاجابة\nكم ضلعاً للمثلث؟,3\n'));
    expect(result.ok).toBe(true);
  });

  it('says which column is missing', () => {
    expect(parseQuestions(csv('سؤال,جواب\nأ,ب\n'))).toEqual({
      ok: false,
      error: 'الصف الأول لازم يكون فيه عمودا «السؤال» و«الإجابة».',
    });
  });

  it('gives the row of a question without an answer, as Excel numbers it', () => {
    expect(parseQuestions(csv('السؤال,الإجابة\nأ,١\nب,\n'))).toEqual({ ok: false, error: 'السؤال في الصف 3 بدون إجابة.' });
  });

  it('refuses a file with no questions', () => {
    expect(parseQuestions(csv('السؤال,الإجابة\n'))).toEqual({ ok: false, error: 'ما لقيت أي سؤال في الملف.' });
  });
});
