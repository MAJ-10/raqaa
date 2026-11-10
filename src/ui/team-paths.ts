import type { Team } from '../engine/types.ts';

/** Each team's symbol as one path on the 24 grid, the same as assets/teams, for drawing inside an SVG. */
export const TEAM_PATHS: Record<Team, string> = {
  coral: 'M12 3.5L21.5 20H2.5Z',
  blue: 'M12 3a9 9 0 1 0 0.001 0Z',
  green: 'M5.5 3.5H18.5A2 2 0 0 1 20.5 5.5V18.5A2 2 0 0 1 18.5 20.5H5.5A2 2 0 0 1 3.5 18.5V5.5A2 2 0 0 1 5.5 3.5Z',
  gold: 'M12 2L22 12L12 22L2 12Z',
};
