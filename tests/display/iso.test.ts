// Phase 5: the display's iso map, drawn from the state as reference/iso-board.md describes it.
import { describe, expect, it } from 'vitest';
import { boardLooks } from '../../src/display/board-art.ts';
import { box, clipX, convexHull, isoUnit, MAP_STEP, planOf, project, TH, type Point } from '../../src/display/iso.ts';
import { basePlot, getBoard } from '../../src/engine/board.ts';
import { Play, sampleSetup } from '../../src/engine/scenarios.ts';
import { options } from '../../src/engine/select.ts';
import type { Team } from '../../src/engine/types.ts';
import { arrange } from '../engine/helpers.ts';

describe('the iso projection', () => {
  it('puts each base at its team’s corner: coral right, blue top, gold left, green bottom, on both maps', () => {
    for (const n of [9, 7] as const) {
      const at = (team: Team) => {
        const plot = getBoard(n).plots[basePlot(n, team)]!;
        const { i, j } = planOf(plot.row, plot.col, n);
        return project(i + 0.5, j + 0.5, 0, 48, n);
      };
      const [coral, blue, green, gold] = (['coral', 'blue', 'green', 'gold'] as const).map(at);
      expect(coral![0]).toBeGreaterThan(100);
      expect(gold![0]).toBeLessThan(-100);
      expect(Math.abs(blue![0])).toBeLessThan(1);
      expect(Math.abs(green![0])).toBeLessThan(1);
      expect(blue![1]).toBeLessThan(green![1]);
    }
  });

  it('draws higher things higher on the screen', () => {
    expect(project(3, 3, 1, 48, 9)[1]).toBeLessThan(project(3, 3, 0, 48, 9)[1]);
    expect(project(3, 3, 1, 48, 9)[0]).toBe(project(3, 3, 0, 48, 9)[0]);
  });
});

describe('the geometry helpers', () => {
  it('finds the convex hull, leaving inner points out', () => {
    const square: Point[] = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ];
    expect(convexHull([...square, [2, 2], [1, 3]])).toHaveLength(4);
  });

  it('cuts a polygon at a vertical line', () => {
    const square: Point[] = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ];
    const left = clipX(square, 1, 'left');
    expect(Math.max(...left.map((p) => p[0]))).toBe(1);
    expect(Math.min(...clipX(square, 1, 'right').map((p) => p[0]))).toBe(1);
  });

  it('gives a flat tile only its top, and a building two faces as well', () => {
    expect(box([0, 0, 1, 1], 0, 0, 0.13, 48, 9)).toMatchObject({ left: '', right: '' });
    const building = box([0, 0, 1, 1], 0, 0.5, 0.13, 48, 9);
    expect(building.left).not.toBe('');
    expect(building.right).not.toBe('');
    expect(building.top).toMatch(/^M.*Z$/);
  });
});

describe('the board from the state', () => {
  const play = new Play(sampleSetup(9, 8)).do({ type: 'game/start' }).question(['coral']).build({ coral: ['1-2'] });
  const looks = boardLooks(play.state, false);
  const plot = (id: string) => looks.find((p) => p.id === id)!;

  it('draws every plot, back to front', () => {
    expect(looks).toHaveLength(81);
    looks.forEach((p, k) => {
      if (k > 0) expect(p.order).toBeGreaterThanOrEqual(looks[k - 1]!.order);
    });
  });

  it('raises a building with its plot’s value, a base counting as 1, with the team’s symbol on the roof', () => {
    expect(plot('1-1')).toMatchObject({ height: TH + MAP_STEP, symbol: 'coral' });
    expect(plot('1-2').height).toBeCloseTo(TH + 2 * MAP_STEP);
    expect(plot('1-2').symbol).toBe('coral');
    expect(plot('1-3').height).toBe(TH);
    expect(plot('1-3').symbol).toBeUndefined();
  });

  it('lays a card on a plot no one has built, and not once it is taken', () => {
    expect(plot('2-3').card).toBe('fence');
    const taken = new Play(sampleSetup(9, 8))
      .do({ type: 'game/start' })
      .question(['coral'])
      .build({ coral: ['1-2'] })
      .endDay()
      .question(['coral'])
      .build({ coral: ['2-2'] })
      .endDay()
      .question(['coral'])
      .build({ coral: ['2-3'] });
    expect(boardLooks(taken.state, false).find((p) => p.id === '2-3')?.card).toBeUndefined();
  });

  it('keeps the tower flat until a team takes it, then raises it highest', () => {
    expect(plot('5-5').height).toBe(TH);
    expect(plot('5-5').symbol).toBeUndefined();
    const towered = boardLooks(arrange(play.state, { gold: ['5-5'] }), false).find((p) => p.id === '5-5')!;
    expect(towered.height).toBeCloseTo(TH + 5 * MAP_STEP);
    expect(towered.symbol).toBe('gold');
  });

  it('takes the night colours for the announcement', () => {
    const night = boardLooks(play.state, true).find((p) => p.id === '1-3')!;
    expect(night.palette).not.toEqual(plot('1-3').palette);
  });

  it('draws the 7×7 map the same way, with larger plots in the same space', () => {
    const small = boardLooks(new Play(sampleSetup(7, 8)).do({ type: 'game/start' }).state, false);
    expect(small).toHaveLength(49);
    const centre = small.find((p) => p.id === '4-4')!;
    expect(centre.height).toBe(TH);
    expect(centre.symbol).toBeUndefined();
    expect(isoUnit(7)).toBeGreaterThan(isoUnit(9));
  });

  it('gives the board to the team in turn: the others sink, its plots to build on rise', () => {
    const turn = new Play(sampleSetup(9, 8)).do({ type: 'game/start' }).question(['coral', 'blue']);
    const team = turn.state.turn!;
    const other = team === 'coral' ? 'blue' : 'coral';
    const focused = boardLooks(turn.state, false);
    const at = (id: string) => focused.find((p) => p.id === id)!;
    const own = getBoard(9).plots[basePlot(9, team)]!.id;
    const theirs = getBoard(9).plots[basePlot(9, other)]!.id;
    expect(at(own)).toMatchObject({ height: TH + MAP_STEP, symbol: team });
    expect(at(own).faded).toBeUndefined();
    expect(at(theirs)).toMatchObject({ height: TH, symbol: other, faded: true });
    const open = options(turn.state, team).build;
    expect(open.length).toBeGreaterThan(0);
    for (const id of open) {
      expect(at(id)).toMatchObject({ open: team });
      expect(at(id).height).toBeCloseTo(TH + getBoard(9).plots[id]!.value * MAP_STEP);
    }
    expect(focused.filter((p) => p.open)).toHaveLength(open.length);
  });

  it('leaves the board as it is outside a team’s turn', () => {
    expect(looks.some((p) => p.open || p.faded)).toBe(false);
  });
});
