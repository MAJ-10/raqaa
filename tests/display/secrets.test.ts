// Criterion 20: the display never shows an answer, a plan or a mission before its time. Many random
// competitions are played through, and at every moment the display's windows and map are checked.
import { describe, expect, it } from 'vitest';
import { BANKS } from '../../src/content/index.ts';
import { boardLooks } from '../../src/display/board-art.ts';
import { displayWindow, JUMP, MOMENT } from '../../src/display/windows.ts';
import { any, demoNext, offered, seeded } from '../../src/engine/autoplay.ts';
import { initialState, reduce } from '../../src/engine/reduce.ts';
import { sampleSetup } from '../../src/engine/scenarios.ts';
import type { GameEvent, GameState } from '../../src/engine/types.ts';

/** Everything the display shows at a moment that could give a secret away. */
function checkDisplay(s: GameState, last: GameEvent): void {
  for (const later of [100, JUMP + MOMENT - 100]) {
    const shown = displayWindow(s, last, last.at + later);
    // The question's answer: only once the referee shows it.
    if (shown?.kind === 'answer') expect(['question', 'asking']).not.toContain(s.step);
    // A mission and its result: only in the announcement.
    if (shown?.kind === 'mission') expect(s.step).toBe('announce');
  }
  // A plan on the map: only where it has struck, never where it was placed.
  for (const look of boardLooks(s, s.step === 'announce')) {
    if (look.plan) expect(s.plots[look.id]?.planShown, `plan shown on ${look.id}`).toBe(true);
  }
  if (last.type === 'card/plan') {
    const looks = boardLooks(s, false).filter((l) => last.plots.includes(l.id));
    expect(looks.every((l) => !l.plan)).toBe(true);
  }
}

describe('nothing shows before its time (criterion 20)', () => {
  it('no answer, plan or mission on the display before its moment, through whole random competitions', { timeout: 60_000 }, () => {
    let plansPlaced = 0;
    let plansStruck = 0;
    // Half the games pick anything the screen offers; the other half play as the demo does, which
    // brings teams together sooner, so more auctions and plans.
    for (let game = 0; game < 160; game++) {
      const random = seeded(500 + game);
      const size = game % 4 < 2 ? 9 : 7;
      const asDemo = game % 2 === 1;
      let s = initialState(sampleSetup(size, size === 9 ? 14 : 8));
      for (let at = 1; at < 5000; at++) {
        const next = asDemo ? demoNext(s, random, BANKS) : any(offered(s, random, BANKS), random);
        if (!next) break; // the end of the announcement, or a plan with nowhere to go
        const event = { ...next, at: at * 5000 } as GameEvent;
        s = reduce(s, event);
        checkDisplay(s, event);
        if (event.type === 'card/plan') plansPlaced++;
        if (event.type === 'plan/take') plansStruck++;
      }
    }
    // The games did place plans and see them strike, so the checks above met both.
    expect(plansPlaced).toBeGreaterThan(5);
    expect(plansStruck).toBeGreaterThan(0);
  });
});
