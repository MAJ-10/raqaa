import type { Team } from '../engine/types.ts';

/** The team's colour in words, as used in accessible labels («الحي المرجاني»). */
export const TEAM_COLOUR: Record<Team, string> = {
  coral: 'المرجاني',
  blue: 'الأزرق',
  green: 'الأخضر',
  gold: 'الذهبي',
};
