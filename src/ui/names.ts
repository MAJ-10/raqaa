// Arabic names shown on screen. Code uses the glossary names (team, plot, mission…).
import type { Level } from '../engine/missions.ts';
import type { Mission, Team } from '../engine/types.ts';
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

/** The team's colour, as used in accessible labels («الحي المرجاني»). */
export const TEAM_COLOUR: Record<Team, string> = {
  coral: 'المرجاني',
  blue: 'الأزرق',
  green: 'الأخضر',
  gold: 'الذهبي',
};

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
