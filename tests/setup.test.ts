import { describe, expect, it } from 'vitest';
import { sampleSetup } from '../src/engine/scenarios.ts';
import { defaultSetup, isReady, setupProblems } from '../src/state/setup.ts';
import { countOf, MISSION_NOUN, QUESTION_NOUN } from '../src/ui/names.ts';
import { secondsLeft } from '../src/ui/time.ts';

describe('the setup', () => {
  it('starts as 9×9 over 12 days, and is not ready until names, missions and questions are in', () => {
    const setup = defaultSetup();
    expect(setup).toMatchObject({ size: 9, days: 12 });
    expect(setupProblems(setup)).toHaveLength(9); // 4 names, 4 mission lists, the questions
    expect(isReady(sampleSetup())).toBe(true);
  });

  it('needs one to three missions for each team', () => {
    const setup = sampleSetup();
    setup.teams.gold.missions = [];
    expect(setupProblems(setup)).toEqual([{ kind: 'missions', team: 'gold' }]);
    setup.teams.gold.missions = ['tower', 'heart', 'block', 'collector'];
    expect(setupProblems(setup)).toEqual([{ kind: 'missions', team: 'gold' }]);
  });

  it('needs a name for each team', () => {
    const setup = sampleSetup();
    setup.teams.blue.name = '   ';
    expect(setupProblems(setup)).toEqual([{ kind: 'name', team: 'blue' }]);
  });
});

describe('the timer', () => {
  it('counts down whole seconds from the event time, and stops at zero', () => {
    expect(secondsLeft(10_000, 45, 10_000)).toBe(45);
    expect(secondsLeft(10_000, 45, 10_400)).toBe(45);
    expect(secondsLeft(10_000, 45, 11_000)).toBe(44);
    expect(secondsLeft(10_000, 45, 54_999)).toBe(1);
    expect(secondsLeft(10_000, 45, 55_000)).toBe(0);
    expect(secondsLeft(10_000, 45, 90_000)).toBe(0);
  });
});

describe('counting in Arabic', () => {
  it('agrees the noun with the number', () => {
    expect(countOf(1, QUESTION_NOUN)).toBe('سؤال واحد');
    expect(countOf(2, QUESTION_NOUN)).toBe('سؤالان');
    expect(countOf(3, QUESTION_NOUN)).toBe('٣ أسئلة');
    expect(countOf(10, QUESTION_NOUN)).toBe('١٠ أسئلة');
    expect(countOf(30, QUESTION_NOUN)).toBe('٣٠ سؤالاً');
    expect(countOf(100, QUESTION_NOUN)).toBe('١٠٠ سؤال');
    expect(countOf(120, QUESTION_NOUN)).toBe('١٢٠ سؤالاً');
    expect(countOf(3, MISSION_NOUN)).toBe('٣ مشاريع');
  });
});
