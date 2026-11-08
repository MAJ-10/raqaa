// Criterion 14: every secret mission, with a success and a failure.
import { describe, expect, it } from 'vitest';
import { missionDone, missionResults } from '../../src/engine/missions.ts';
import { sampleSetup } from '../../src/engine/scenarios.ts';
import type { GameState, Mission, Team } from '../../src/engine/types.ts';
import { startWith } from './helpers.ts';

type Plots = Partial<Record<Team, string[]>>;

function state(owners: Plots, history: Partial<GameState['teams']['coral']> = {}): GameState {
  const { state: s } = startWith(owners);
  Object.assign(s.teams.coral, history);
  return s;
}

const cases: [Mission, string, GameState, boolean][] = [
  // شارع داخلي: 4 in a row or column, none on the map's outer row or column.
  ['innerStreet', 'four in a row inside the map', state({ coral: ['3-2', '3-3', '3-4', '3-5'] }), true],
  ['innerStreet', 'a column of four', state({ coral: ['2-4', '3-4', '4-4', '5-4'] }), true],
  ['innerStreet', 'four in a row touching the edge', state({ coral: ['1-2', '1-3', '1-4', '1-5'] }), false],
  ['innerStreet', 'three in a row', state({ coral: ['3-2', '3-3', '3-4'] }), false],
  // مربع سكني: a 2×2 square without the base.
  ['block', 'a 2×2 square', state({ coral: ['3-3', '3-4', '4-3', '4-4'] }), true],
  ['block', 'a square that uses the base', state({ coral: ['1-2', '2-1', '2-2'] }), false],
  // جامع البطاقات: two cards taken from the map.
  ['collector', 'two cards taken', state({}, { cardsTaken: 2 }), true],
  ['collector', 'one card taken', state({}, { cardsTaken: 1 }), false],
  // يد في كل حلقة: ring 1, ring 2 and the outer ring; the base doesn't count.
  ['everyRing', 'one plot in each ring', state({ coral: ['4-5', '3-5', '2-5'] }), true],
  ['everyRing', 'only the base in the outer ring', state({ coral: ['4-5', '3-5'] }), false],
  // من حيين: plots taken from two different teams.
  ['twoTeams', 'taken from blue and green', state({}, { takenFrom: ['blue', 'green'] }), true],
  ['twoTeams', 'taken twice from blue', state({}, { takenFrom: ['blue', 'blue'] }), false],
  // مزايد ناجح: two auctions won as the bidder.
  ['successfulBidder', 'two wins as bidder', state({}, { bidderWins: 2 }), true],
  ['successfulBidder', 'one win as bidder', state({}, { bidderWins: 1 }), false],
  // برج الرقعة: own the tower.
  ['tower', 'owns the centre', state({ coral: ['5-5'] }), true],
  ['tower', 'next to the centre', state({ coral: ['5-4'], blue: ['5-5'] }), false],
  // قلب المدينة: 3 plots of ring 1.
  ['heart', 'three plots of ring 1', state({ coral: ['4-4', '4-5', '4-6'] }), true],
  ['heart', 'two plots of ring 1 and the tower', state({ coral: ['4-4', '4-5', '5-5'] }), false],
  // جار الجميع: land touching all three other teams.
  ['neighbourOfAll', 'touches blue, green and gold', state({ coral: ['5-5'], blue: ['4-5'], green: ['5-4'], gold: ['6-5'] }), true],
  ['neighbourOfAll', 'touches only two', state({ coral: ['5-5'], blue: ['4-5'], green: ['5-4'], gold: ['8-8'] }), false],
];

describe('secret missions (criterion 14)', () => {
  it.each(cases)('%s: %s', (mission, _label, s, expected) => {
    expect(missionDone(s, 'coral', mission)).toBe(expected);
  });

  it('every mission has a success and a failure case', () => {
    const missions = new Set(cases.map(([m]) => m));
    expect(missions.size).toBe(9);
    for (const mission of missions) {
      const outcomes = new Set(cases.filter(([m]) => m === mission).map(([, , , done]) => done));
      expect(outcomes).toEqual(new Set([true, false]));
    }
  });

  it('scores +4/−2 easy, +8/−4 medium and +12/−6 hard', () => {
    const setup = sampleSetup();
    setup.teams.coral.missions = ['collector', 'block', 'twoTeams', 'everyRing', 'tower', 'heart'];
    const { state: s } = startWith({ coral: ['5-5'] }, setup);
    s.teams.coral.cardsTaken = 2;
    s.teams.coral.takenFrom = ['blue', 'gold'];
    expect(missionResults(s, 'coral').map((r) => r.points)).toEqual([4, -2, 8, -4, 12, -6]);
  });
});
