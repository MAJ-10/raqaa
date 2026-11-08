// Challenge content. The referee window makes it with these functions and puts it in the event,
// so replaying the events always gives the same challenge.
import { CHALLENGES, type ChallengeContent, type ChallengeType, type GameState, type MathOp } from './types.ts';

export type Random = () => number;

/** The built-in banks, by item id. Ordering sentences give their word count. */
export type Banks = {
  spelling: string[];
  ordering: { id: string; length: number }[];
  images: string[];
  words: string[];
};

export type MathContent = Extract<ChallengeContent, { type: 'math' }>;

export type MadeContent = {
  content: ChallengeContent;
  /** The bank ran out, so items shown before came back (the oldest first). The referee is told. */
  recycled: boolean;
};

const MEMORY_ITEMS = 8;

const pick = <T>(items: readonly T[], random: Random): T => items[Math.floor(random() * items.length)]!;
const between = (min: number, max: number, random: Random) => min + Math.floor(random() * (max - min + 1));

const apply = (value: number, op: MathOp, n: number): number =>
  op === '+' ? value + n : op === '-' ? value - n : op === '*' ? value * n : value / n;

/**
 * A start number from 2 to 20, then 3 to 5 operations: + and − with 1 to 20, × and ÷ with 2 to 5.
 * Every result along the way is a whole number from 1 to 100.
 */
export function makeMath(random: Random = Math.random): MathContent {
  const start = between(2, 20, random);
  let value = start;
  const steps: MathContent['steps'] = [];
  const count = between(3, 5, random);
  for (let i = 0; i < count; i++) {
    const choices: { op: MathOp; n: number }[] = [];
    for (let n = 1; n <= 20; n++) {
      if (value + n <= 100) choices.push({ op: '+', n });
      if (value - n >= 1) choices.push({ op: '-', n });
    }
    for (let n = 2; n <= 5; n++) {
      if (value * n <= 100) choices.push({ op: '*', n });
      if (value % n === 0) choices.push({ op: '/', n });
    }
    // Pick the operation first, so × and ÷ come up as often as + and −.
    const op = pick([...new Set(choices.map((c) => c.op))], random);
    const step = pick(
      choices.filter((c) => c.op === op),
      random,
    );
    value = apply(value, step.op, step.n);
    steps.push(step);
  }
  return { type: 'math', start, steps, answer: value };
}

/** Works out a math challenge's answer from its steps. */
export function solveMath(content: MathContent): number {
  return content.steps.reduce((value, step) => apply(value, step.op, step.n), content.start);
}

/**
 * Picks items not shown yet. When the bank runs out, it adds the items shown longest ago,
 * and reports it as recycled.
 */
export function pickFresh(
  bank: readonly string[],
  used: readonly string[],
  count: number,
  random: Random,
): { items: string[]; recycled: boolean } {
  if (bank.length === 0) throw new Error('The bank is empty');
  const pool = bank.filter((id) => !used.includes(id));
  const items: string[] = [];
  while (items.length < count && pool.length > 0) {
    items.push(pool.splice(Math.floor(random() * pool.length), 1)[0]!);
  }
  if (items.length < count) {
    const lastShown = (id: string) => used.lastIndexOf(id);
    const oldest = bank.filter((id) => !items.includes(id)).sort((a, b) => lastShown(a) - lastShown(b));
    items.push(...oldest.slice(0, count - items.length));
  }
  return { items, recycled: items.some((id) => used.includes(id)) };
}

/** A shuffled order of a sentence's words, never the right order (for sentences of 2 words or more). */
export function scramble(length: number, random: Random): number[] {
  const order = Array.from({ length }, (_, i) => i);
  if (length < 2) return order;
  do {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
  } while (order.every((word, i) => word === i));
  return order;
}

/** New content of a given type. Used for a new challenge and for replaying a tied one. */
export function makeContent(s: GameState, type: ChallengeType, banks: Banks, random: Random = Math.random): MadeContent {
  switch (type) {
    case 'math':
      return { content: makeMath(random), recycled: false };
    case 'spelling': {
      const { items, recycled } = pickFresh(banks.spelling, s.used.spelling, 1, random);
      return { content: { type, word: items[0]! }, recycled };
    }
    case 'ordering': {
      const ids = banks.ordering.map((sentence) => sentence.id);
      const { items, recycled } = pickFresh(ids, s.used.ordering, 1, random);
      const sentence = banks.ordering.find((x) => x.id === items[0])!;
      return { content: { type, sentence: sentence.id, order: scramble(sentence.length, random) }, recycled };
    }
    case 'memory': {
      // Memory challenges alternate: images, then words, then images...
      const kind = s.memoryCount % 2 === 0 ? 'images' : 'words';
      const { items, recycled } = pickFresh(banks[kind], s.used[kind], MEMORY_ITEMS, random);
      return { content: { type, kind, items }, recycled };
    }
    case 'precision':
    case 'building':
      return { content: { type }, recycled: false };
  }
}

/** Each challenge's type is random, from the six types. */
export function newChallenge(s: GameState, banks: Banks, random: Random = Math.random): MadeContent {
  return makeContent(s, pick(CHALLENGES, random), banks, random);
}
