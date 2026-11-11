// Games the display's tests share.
import { Play, sampleSetup } from '../../src/engine/scenarios.ts';
import type { Team } from '../../src/engine/types.ts';

/** A 7×7 game four days in: coral reaches 2-4 and holds the bridge it took there. */
export function fourSmallDays(): Play {
  const two: Team[] = ['coral', 'blue'];
  return new Play(sampleSetup(7, 8))
    .do({ type: 'game/start' })
    .question(two)
    .build({ coral: ['1-2'], blue: ['1-6'] })
    .endDay()
    .question(two)
    .build({ coral: ['1-3'], blue: ['1-5'] })
    .endDay()
    .question(two)
    .build({ coral: ['1-4'], blue: ['2-5'] })
    .endDay()
    .question(two)
    .build({ coral: ['2-4'], blue: ['3-5'] })
    .endDay();
}
