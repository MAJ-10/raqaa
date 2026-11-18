// Arabic names shown on screen. Code uses the glossary names (team, plot, mission…).
import cards from '../../assets/cards/cards.json';
import type { Level } from '../engine/missions.ts';
import { MEMORY } from '../engine/timing.ts';
import type { Card, ChallengeType, MathOp, Mission, PlotId, QuestionKind } from '../engine/types.ts';
import { formatNumber } from './number.ts';

type Noun = { one: string; two: string; plural: string; accusative: string; genitive: string };

/** A count with its noun, the way Arabic says it: سؤال واحد، سؤالان، ٣ أسئلة، ١٢ سؤالاً، ١٠٠ سؤال. */
export function countOf(n: number, noun: Noun): string {
  if (n === 1) return noun.one;
  if (n === 2) return noun.two;
  const lastTwo = n % 100;
  const word = lastTwo >= 3 && lastTwo <= 10 ? noun.plural : lastTwo >= 11 ? noun.accusative : noun.genitive;
  return `${formatNumber(n)} ${word}`;
}

export const SECOND_NOUN: Noun = {
  one: 'ثانية واحدة',
  two: 'ثانيتان',
  plural: 'ثوانٍ',
  accusative: 'ثانية',
  genitive: 'ثانية',
};

export const QUESTION_NOUN: Noun = {
  one: 'سؤال واحد',
  two: 'سؤالان',
  plural: 'أسئلة',
  accusative: 'سؤالاً',
  genitive: 'سؤال',
};

export const MISSION_NOUN: Noun = {
  one: 'مشروع واحد',
  two: 'مشروعان',
  plural: 'مشاريع',
  accusative: 'مشروعاً',
  genitive: 'مشروع',
};

export { TEAM_COLOUR } from './team-colour.ts';

export const MISSION_NAMES: Record<Mission, string> = {
  innerStreet: 'شارع داخلي',
  block: 'مربع سكني',
  collector: 'جامع البطاقات',
  everyRing: 'يد في كل حلقة',
  twoTeams: 'من حيين',
  successfulBidder: 'مزايد ناجح',
  tower: 'برج الرقعة',
  heart: 'قلب المدينة',
  neighbourOfAll: 'جار الجميع',
};

/** What each mission asks, as the requirements word it, with the changes in docs/decisions.md. */
export const MISSION_TEXT: Record<Mission, string> = {
  innerStreet: '٤ قطع متتالية في صف أو عمود، وكلها بعيدة عن حافة الخريطة',
  block: '٤ قطع على شكل مربع ٢×٢، ما فيها البلدية',
  collector: 'خذ بطاقتين من الخريطة',
  everyRing: 'قطعة في الحلقة الأولى، وقطعة في الثانية، وقطعة في الخارجية',
  twoTeams: 'خذ قطعة من حيين مختلفين، بمزاد أو بمخطط سري',
  successfulBidder: 'اكسب مزادين وأنت المزايد',
  tower: 'امتلك برج الرقعة',
  heart: '٣ قطع من الحلقة الأولى',
  neighbourOfAll: 'أرضك تلاصق أرض الأحياء الثلاثة',
};

export const LEVEL_NAMES: Record<Level, string> = { easy: 'سهلة', medium: 'متوسطة', hard: 'صعبة' };

export const CARD_NAMES: Record<Card, string> = {
  fence: cards.fence.name,
  crane: cards.crane.name,
  bridge: cards.bridge.name,
  plan: cards.plan.name,
  inspector: cards.inspector.name,
};

/** A card's name inside a sentence, with the article: «كسب الرافعة». */
export const CARD_THE: Record<Card, string> = {
  fence: 'السياج',
  crane: 'الرافعة',
  bridge: 'الجسر',
  plan: 'المخطط السري',
  inspector: 'مفتش البلدية',
};

/** What each card does, in a few words, for the referee. */
export const CARD_POWER: Record<Card, string> = {
  fence: 'يلغي مزاداً على أرض صاحبه',
  crane: 'حركة إضافية في اليوم، ولو بلا تصريح',
  bridge: 'يبني على بُعد قطعتين من أرضه',
  plan: 'فخ على قطعتين لمن يزايد عليهما',
  inspector: 'يكشف مشاريع حي آخر',
};

/** When each card is used. */
export const CARD_WHEN: Record<Card, string> = {
  fence: 'عند المزاد',
  crane: 'في الدور',
  bridge: 'في الدور',
  plan: 'عند الأخذ',
  inspector: 'عند الأخذ',
};

export const CHALLENGE_NAMES: Record<ChallengeType, string> = {
  math: 'حساب ذهني',
  spelling: 'تهجئة',
  memory: 'ذاكرة',
  ordering: 'ترتيب',
};

/** The signs of the mental maths challenge, as people write them. */
export const MATH_OPS: Record<MathOp, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/** What each challenge is, in a line: on the display before it starts, and for the referee throughout. */
export const CHALLENGE_RULES: Record<ChallengeType, string> = {
  math: 'معادلة رياضية، أول من يحلها يفوز.',
  spelling: 'اسمع الكلمة من المنظم، واكتبها بشكل صحيح. أول كتابة صحيحة تفوز.',
  memory: `احفظوا العناصر في ${countOf(MEMORY.show, SECOND_NOUN)}، ثم اكتبوها في ${countOf(MEMORY.write, SECOND_NOUN)}. الأكثر صحيحاً يفوز.`,
  ordering: 'رتّبوا كلمات الجملة. أول ترتيب صحيح يفوز.',
};

/** A plot as people read it: (row، column). */
export function plotName(id: PlotId): string {
  const [row, col] = id.split('-').map(Number);
  return `(${formatNumber(row ?? 0)}، ${formatNumber(col ?? 0)})`;
}

export const MOVE_NOUN: Noun = {
  one: 'حركة واحدة',
  two: 'حركتان',
  plural: 'حركات',
  accusative: 'حركة',
  genitive: 'حركة',
};

export const BUILDING_NOUN: Noun = {
  one: 'مبنى واحد',
  two: 'مبنيان',
  plural: 'مبانٍ',
  accusative: 'مبنى',
  genitive: 'مبنى',
};

export const AUCTION_NOUN: Noun = {
  one: 'مزاد واحد',
  two: 'مزادان',
  plural: 'مزادات',
  accusative: 'مزاداً',
  genitive: 'مزاد',
};

export const KIND_NAMES: Record<QuestionKind, string> = { individual: 'فردي', group: 'جماعي' };

export const DAY_NOUN: Noun = {
  one: 'يوم واحد',
  two: 'يومان',
  plural: 'أيام',
  accusative: 'يوماً',
  genitive: 'يوم',
};
