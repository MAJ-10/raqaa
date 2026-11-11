import { describe, expect, it } from 'vitest';
import { announceStep } from '../../src/display/windows.ts';
import { ranking } from '../../src/engine/missions.ts';
import { landingStory } from '../../src/landing/story.ts';

describe('the landing page story', () => {
  const { frames, podium } = landingStory();

  it('builds the city one plot at a time, from the first morning', () => {
    expect(frames[0]).toMatchObject({ move: null, ring: 'base', part: 0, day: 1 });
    const built = frames.map((f) => Object.values(f.state.plots).filter((p) => p.owner).length);
    for (let i = 1; i < frames.length; i++) expect(built[i]! - built[i - 1]!).toBeLessThanOrEqual(1);
    expect(frames.filter((f) => f.move?.type === 'build')).toHaveLength(4 * 4 + 2 + 1 + 1);
    // No team is in turn in any frame: the map shows the city, not a move being chosen.
    expect(frames.every((f) => f.state.turn === null && f.state.step === 'dayEnd')).toBe(true);
  });

  it('reaches each ring in order, then the tower', () => {
    const rings = frames.map((f) => f.ring).filter((ring, i, all) => ring !== all[i - 1]);
    expect(rings).toEqual(['base', 'outer', 'second', 'first', 'tower']);
    expect(frames.find((f) => f.ring === 'tower')!.state.plots['4-4']?.owner).toBe('coral');
    const parts = frames.map((f) => f.part);
    expect([...parts].sort()).toEqual(parts);
  });

  it('ends with a bid and the plot won, then the podium', () => {
    const [bid, won] = frames.slice(-2);
    expect(bid!.move).toEqual({ type: 'auction/declare', team: 'blue', plot: '3-4' });
    expect(bid!.state.plots['3-4']?.owner).toBe('coral');
    expect(won!.move).toEqual({ type: 'build', team: 'blue', plot: '3-4' });
    expect(won!.state.plots['3-4']?.owner).toBe('blue');
    expect(bid!.part).toBe(3);
    expect(announceStep(podium)?.kind).toBe('podium');
    expect(ranking(podium).map((row) => [row.team, row.score * 100])).toEqual([
      ['coral', 3000],
      ['blue', 2500],
      ['gold', 2000],
      ['green', 1100],
    ]);
  });
});
