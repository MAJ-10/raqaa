// Reads the referee's questions file (Excel or CSV) with SheetJS, bundled in the app.
// Where questions come from (a file today, maybe a built-in bank later) is kept apart from how a file is read.
import { read, utils, writeFile, type WorkBook } from 'xlsx';
import type { Question } from '../engine/types.ts';

export type ReadResult = { ok: true; questions: Question[] } | { ok: false; error: string };

const QUESTION = 'السؤال';
const ANSWER = 'الإجابة';

/** Header matching forgives hamza forms, diacritics and stray spaces: «الاجابة» works too. */
function normalise(text: string): string {
  return text
    .replace(/﻿/g, '')
    .replace(/[ً-ْـ]/g, '') // diacritics and tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim();
}

const cell = (value: unknown) => String(value ?? '').trim();

/** Reads questions from the bytes of an .xlsx, .xls or .csv file. CSV is read as UTF-8. */
export function parseQuestions(data: Uint8Array): ReadResult {
  let book: WorkBook;
  try {
    // Excel files start with a ZIP (.xlsx) or OLE (.xls) signature. Anything else is text: decode it as
    // UTF-8 here (dropping any BOM), so Arabic is read right without SheetJS's code page tables.
    const excel = (data[0] === 0x50 && data[1] === 0x4b) || (data[0] === 0xd0 && data[1] === 0xcf);
    book = excel
      ? read(data, { type: 'array', dense: true })
      : read(new TextDecoder('utf-8').decode(data), { type: 'string', dense: true });
  } catch {
    return { ok: false, error: 'ما قدرت أقرأ الملف. استخدم ملف Excel أو CSV.' };
  }
  const sheet = book.Sheets[book.SheetNames[0] ?? ''];
  if (!sheet) return { ok: false, error: 'الملف فاضي.' };

  const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: true, defval: '', raw: false });
  const header = (rows[0] ?? []).map((value) => normalise(cell(value)));
  const q = header.indexOf(normalise(QUESTION));
  const a = header.indexOf(normalise(ANSWER));
  if (q < 0 || a < 0) {
    return { ok: false, error: `الصف الأول لازم يكون فيه عمودا «${QUESTION}» و«${ANSWER}».` };
  }

  const questions: Question[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const text = cell(row[q]);
    const answer = cell(row[a]);
    if (!text && !answer) continue;
    const line = i + 1; // the row number as Excel shows it
    if (!answer) return { ok: false, error: `السؤال في الصف ${line} بدون إجابة.` };
    if (!text) return { ok: false, error: `الإجابة في الصف ${line} بدون سؤال.` };
    questions.push({ text, answer });
  }
  if (questions.length === 0) return { ok: false, error: 'ما لقيت أي سؤال في الملف.' };
  return { ok: true, questions };
}

export async function readQuestionsFile(file: File): Promise<ReadResult> {
  return parseQuestions(new Uint8Array(await file.arrayBuffer()));
}

/** Downloads an empty Excel template with the two columns, laid out right to left. */
export function downloadTemplate(): void {
  const sheet = utils.aoa_to_sheet([[QUESTION, ANSWER]]);
  sheet['!cols'] = [{ wch: 60 }, { wch: 24 }];
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, 'الأسئلة');
  book.Workbook = { Views: [{ RTL: true }] };
  writeFile(book, 'قالب أسئلة رقعة.xlsx');
}
