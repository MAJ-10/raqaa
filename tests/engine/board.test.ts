// Criterion 1: both sizes with their values, cards and bases. And adjacency by edge only.
import { describe, expect, it } from 'vitest';
import { basePlot, getBoard, neighbours } from '../../src/engine/board.ts';
import type { Card, Size } from '../../src/engine/types.ts';

const countBy = <T>(items: T[]) =>
  items.reduce<Record<string, number>>((all, item) => ({ ...all, [String(item)]: (all[String(item)] ?? 0) + 1 }), {});

describe('the map (criterion 1)', () => {
  it.each([
    [9, { 5: 1, 4: 8, 3: 16, 2: 52, 1: 4 }],
    [7, { 5: 1, 4: 8, 3: 16, 2: 20, 1: 4 }],
  ] as [Size, Record<number, number>][])('%i×%i has the right number of plots of each value', (size, expected) => {
    const board = getBoard(size);
    expect(board.ids).toHaveLength(size * size);
    expect(countBy(board.ids.map((id) => board.plots[id]!.value))).toEqual(
      Object.fromEntries(Object.entries(expected).map(([k, v]) => [k, v])),
    );
    expect(board.plots[board.centre]!.value).toBe(5);
  });

  it.each([9, 7] as Size[])('%i×%i puts the bases in the four corners', (size) => {
    expect(basePlot(size, 'coral')).toBe('1-1');
    expect(basePlot(size, 'blue')).toBe(`1-${size}`);
    expect(basePlot(size, 'green')).toBe(`${size}-1`);
    expect(basePlot(size, 'gold')).toBe(`${size}-${size}`);
    const board = getBoard(size);
    expect(board.ids.filter((id) => board.plots[id]!.base)).toHaveLength(4);
  });

  const cardsAt = (size: Size) => {
    const board = getBoard(size);
    const found: Partial<Record<Card, string[]>> = {};
    for (const id of board.ids) {
      const card = board.plots[id]!.card;
      if (card) (found[card] ??= []).push(id);
    }
    return found;
  };

  it('9×9 has the cards on the plots from the requirements', () => {
    expect(cardsAt(9)).toEqual({
      fence: ['2-3', '2-7', '8-3', '8-7'],
      crane: ['3-2', '3-8', '7-2', '7-8'],
      bridge: ['3-5', '7-5'],
      plan: ['4-5', '6-5'],
      inspector: ['5-4', '5-6'],
    });
  });

  it('7×7 has the cards on the plots from the requirements', () => {
    expect(cardsAt(7)).toEqual({
      fence: ['2-3', '2-5', '6-3', '6-5'],
      crane: ['3-2', '3-6', '5-2', '5-6'],
      bridge: ['2-4', '6-4'],
      plan: ['3-4', '5-4'],
      inspector: ['4-3', '4-5'],
    });
  });

  it('plots touch by an edge only, never diagonally', () => {
    const board = getBoard(9);
    expect(neighbours(board, '5-5').sort()).toEqual(['4-5', '5-4', '5-6', '6-5']);
    expect(neighbours(board, '1-1').sort()).toEqual(['1-2', '2-1']);
    expect(neighbours(board, '5-5')).not.toContain('4-4');
  });
});
