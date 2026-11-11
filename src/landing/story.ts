// The competition the landing page tells: a short 7×7 game played by the engine itself, so every move in
// it follows the rules. Its frames build the city as the page scrolls, ring by ring to the tower, then a
// neighbour takes a plot by auction; its end is the podium at the bottom of the page. Names and
// questions are made up.
import { getBoard } from '../engine/board.ts';
import { announcement } from '../engine/missions.ts';
import { initialState, reduce } from '../engine/reduce.ts';
import { Play } from '../engine/scenarios.ts';
import type { GameEvent, GameState, Setup, Team } from '../engine/types.ts';

const ALL: Team[] = ['coral', 'blue', 'green', 'gold'];

/** The story's competition: four neighbourhoods with made-up names, one mission each, and sums for questions. */
function storySetup(): Setup {
  const sums: [number, number][] = [
    [6, 7],
    [8, 9],
    [7, 4],
    [9, 6],
    [5, 8],
    [7, 7],
    [6, 9],
  ];
  return {
    size: 7,
    days: 7,
    teams: {
      coral: { name: 'الرواد', players: 4, missions: ['tower'] },
      blue: { name: 'النجوم', players: 4, missions: ['everyRing'] },
      green: { name: 'الصقور', players: 4, missions: ['block'] },
      gold: { name: 'الفرسان', players: 4, missions: ['collector'] },
    },
    questions: sums.map(([a, b]) => ({ text: `كم يساوي ${a} × ${b}؟`, answer: String(a * b) })),
    questionSource: { kind: 'demo', name: 'أسئلة القصة' },
  };
}

/**
 * The game, day by day. Four days in which every team answers right and builds toward the middle: the
 * outer ring, the second (and its fences), the first. Then coral reaches the tower (taking a plan on the
 * way, while gold takes the bridge), and on the last day blue bids for coral's plot beside it and wins.
 */
function played(): Play {
  const play = new Play(storySetup()).do({ type: 'game/start' });
  const together = [
    { coral: ['1-2'], blue: ['1-6'], green: ['7-2'], gold: ['7-6'] },
    { coral: ['2-2'], blue: ['2-6'], green: ['6-2'], gold: ['6-6'] },
    { coral: ['2-3'], blue: ['2-5'], green: ['6-3'], gold: ['6-5'] },
    { coral: ['3-3'], blue: ['3-5'], green: ['5-3'], gold: ['5-5'] },
  ];
  for (const day of together) play.question(ALL).build(day).endDay();
  play
    .question(['coral', 'gold'])
    .build({ coral: [{ build: '3-4', plan: ['2-2', '2-3'] }], gold: ['6-4'] })
    .endDay();
  play.question(['coral']).build({ coral: ['4-4'] }).endDay();
  return play.question(['blue']).build({ blue: [{ auction: '3-4' }] }).auction(['blue', 'blue']);
}

/** The map's rings from the edge in, by what a plot there is worth: the base, the outer ring, the second, the first, the tower. */
export const RINGS = ['base', 'outer', 'second', 'first', 'tower'] as const;
export type Ring = (typeof RINGS)[number];

/** A step of the city as the page scrolls. */
export type CityFrame = {
  /** The city, calm as at the end of a day: no team in turn, so nothing sinks and no plot is numbered. */
  state: GameState;
  /** What just happened on the map, for its motion: a building, a bid's pin, or a plot won. Null at the start. */
  move: Omit<Extract<GameEvent, { type: 'build' | 'auction/declare' }>, 'at'> | null;
  day: number;
  /** The innermost ring the city has reached. */
  ring: Ring;
  /** Which part of the story it belongs to: the start, the first days, the way to the middle, the auction. */
  part: 0 | 1 | 2 | 3;
};

const calm = (state: GameState): GameState => ({ ...state, step: 'dayEnd', turn: null, pending: null });

/** The innermost ring a team has built on: the dearest plot built so far. */
function reached(state: GameState): Ring {
  const board = getBoard(state.setup.size);
  const built = Object.entries(state.plots).filter(([, plot]) => plot.owner && plot.since !== null);
  return RINGS[Math.max(1, ...built.map(([id]) => board.plots[id]?.value ?? 1)) - 1]!;
}

/**
 * The story in frames, and its end: the first morning, then each building as it goes up, then blue's bid
 * (the pin) and the plot it wins, which lands as a building does; and the state of the podium.
 */
export function landingStory(): { frames: CityFrame[]; podium: GameState } {
  const play = played();
  const events = [...play.events];
  play.do({ type: 'game/end' });
  while (announcement(play.state)[play.state.announce]?.kind !== 'podium') play.do({ type: 'announce/next' });

  const frames: CityFrame[] = [];
  let state = initialState(play.state.setup);
  for (const event of events) {
    state = reduce(state, event);
    const part = state.day <= 3 ? 1 : state.day <= 6 ? 2 : 3;
    const frame = (move: CityFrame['move'], as: CityFrame['part'] = part) => frames.push({ state: calm(state), move, day: state.day, ring: reached(state), part: as });
    if (event.type === 'game/start') frame(null, 0);
    if (event.type === 'build') frame({ type: 'build', team: event.team, plot: event.plot });
    if (event.type === 'auction/declare') frame({ type: 'auction/declare', team: event.team, plot: event.plot });
    if (event.type === 'challenge/result') {
      const auction = state.auctions[event.auction];
      if (auction?.status === 'done' && auction.winner === auction.bidder) frame({ type: 'build', team: auction.bidder, plot: auction.plot });
    }
  }
  return { frames, podium: play.state };
}
