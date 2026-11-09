// Arabic names shown on screen. Code uses the glossary names (team, plot, mission…).
import cards from '../../assets/cards/cards.json';
import type { Level } from '../engine/missions.ts';
import type { Card, ChallengeType, Mission, PlotId } from '../engine/types.ts';
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

export const QUESTION_NOUN: Noun = {
  one: 'سؤال واحد',
  two: 'سؤالان',
  plural: 'أسئلة',
  accusative: 'سؤالاً',
  genitive: 'سؤال',
};

export const PLAYER_NOUN: Noun = {
  one: 'لاعب واحد',
  two: 'لاعبان',
  plural: 'لاعبين',
  accusative: 'لاعباً',
  genitive: 'لاعب',
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

export const LEVEL_NAMES: Record<Level, string> = { easy: 'سهلة', medium: 'متوسطة', hard: 'صعبة' };

export const CARD_NAMES: Record<Card, string> = {
  fence: cards.fence.name,
  crane: cards.crane.name,
  bridge: cards.bridge.name,
  plan: cards.plan.name,
  inspector: cards.inspector.name,
};

/** When each card is used. */
export const CARD_WHEN: Record<Card, string> = {
  fence: 'عند المزاد',
  crane: 'في الدور',
  bridge: 'في الدور',
  plan: 'عند الأخذ',
  inspector: 'أي وقت',
};

export const CHALLENGE_NAMES: Record<ChallengeType, string> = {
  math: 'حساب ذهني',
  spelling: 'تهجئة',
  memory: 'ذاكرة',
  ordering: 'ترتيب',
  precision: 'دقة',
  building: 'بناء',
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

export const DAY_NOUN: Noun = {
  one: 'يوم واحد',
  two: 'يومان',
  plural: 'أيام',
  accusative: 'يوماً',
  genitive: 'يوم',
};
