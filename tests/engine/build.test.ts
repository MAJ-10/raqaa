// Criteria 2, 3, 6 and 7: building, the bridge, the build order and who gets a turn. Also the question flow.
import { describe, expect, it } from 'vitest';
import { RuleError } from '../../src/engine/reduce.ts';
import { Play, sampleSetup } from '../../src/engine/scenarios.ts';
import { buildOrder, canBridge, canBuild, currentQuestion, options, questionsLeft } from '../../src/engine/select.ts';
import { arrange, give, startWith } from './helpers.ts';

describe('building (criterion 2)', () => {
  it('only an empty plot next to the team can be built; diagonal does not count', () => {
    const { state } = startWith({ coral: ['3-3'], blue: ['3-4'] });
    expect(canBuild(state, 'coral', '2-3')).toBe(true);
    expect(canBuild(state, 'coral', '3-2')).toBe(true);
    expect(canBuild(state, 'coral', '2-2')).toBe(false); // diagonal
    expect(canBuild(state, 'coral', '3-4')).toBe(false); // taken
    expect(canBuild(state, 'coral', '3-6')).toBe(false); // far away
  });

  it('refuses a diagonal build', () => {
    const play = startWith().question(['coral']);
    expect(() => play.do({ type: 'build', team: 'coral', plot: '2-2' })).toThrow(RuleError);
    play.do({ type: 'build', team: 'coral', plot: '2-1' });
    expect(play.state.plots['2-1']).toMatchObject({ owner: 'coral', since: 1 });
  });

  it('keeps land that is cut off from the base, and builds from it', () => {
    const { state } = startWith({ coral: ['5-5'] });
    expect(canBuild(state, 'coral', '5-6')).toBe(true);
  });
});

describe('the bridge (criterion 3)', () => {
  it('reaches an empty plot exactly two steps away in the same row or column', () => {
    const { state } = startWith({ coral: ['5-5'] });
    expect(canBridge(state, 'coral', '5-7')).toBe(true);
    expect(canBridge(state, 'coral', '3-5')).toBe(true);
    expect(canBridge(state, 'coral', '7-7')).toBe(false); // diagonal
    expect(canBridge(state, 'coral', '5-8')).toBe(false); // three steps
    expect(canBridge(state, 'coral', '5-6')).toBe(false); // next to the team: a normal build
  });

  it('uses a move and the bridge card', () => {
    const play = startWith({ coral: ['5-5'] });
    play.state = give(play.state, 'coral', ['bridge']);
    play.question(['coral']);
    play.do({ type: 'build', team: 'coral', plot: '5-7', via: 'bridge' });
    expect(play.state.plots['5-7']?.owner).toBe('coral');
    expect(play.state.teams.coral).toMatchObject({ moves: 0, cards: [], cardUsedToday: true, moveCount: 1 });
  });

  it('needs the bridge card', () => {
    const play = startWith({ coral: ['5-5'] }).question(['coral']);
    expect(() => play.do({ type: 'build', team: 'coral', plot: '5-7', via: 'bridge' })).toThrow(RuleError);
  });
});

describe('build order (criterion 6)', () => {
  it('puts the fewest points first, then the fewest plots, then the fixed order', () => {
    const play = startWith({
      coral: ['2-1', '3-1'], // 1 + 2 + 2 = 5 points, 3 plots
      blue: ['5-5'], // 1 + 5 = 6 points
      green: ['8-1', '5-6'], // 1 + 2 + 4 = 7 points
      gold: ['9-8', '9-7'], // 1 + 2 + 2 = 5 points, 3 plots
    });
    expect(buildOrder(play.state)).toEqual(['coral', 'gold', 'blue', 'green']);
    play.state = arrange(play.state, { gold: ['8-8'] }); // gold: 7 points like green, but 4 plots to 3
    expect(buildOrder(play.state)).toEqual(['coral', 'blue', 'green', 'gold']);
  });

  it('breaks a points tie by fewer plots, before the fixed order', () => {
    const { state } = startWith({ coral: ['2-1', '3-3'], blue: ['5-5'] }); // both 6 points; coral 3 plots, blue 2
    expect(buildOrder(state).slice(-2)).toEqual(['blue', 'coral']);
  });

  it('turns the fixed order every day: coral first on day 1, blue on day 2, back to coral on day 5', () => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' });
    const firsts: string[] = [];
    for (let day = 1; day <= 5; day++) {
      firsts.push(buildOrder(play.state)[0]!);
      play.question([]).endDay();
    }
    expect(firsts).toEqual(['coral', 'blue', 'green', 'gold', 'coral']);
  });
});

describe('who gets a turn (criterion 7)', () => {
  it('a team that answered right must move: it cannot pass', () => {
    const play = startWith().question(['coral']);
    expect(play.state.turn).toBe('coral');
    expect(() => play.do({ type: 'turn/pass', team: 'coral' })).toThrow(RuleError);
  });

  it('a team without a permit gets no turn', () => {
    const play = startWith().question(['blue']);
    expect(play.state.order[0]).toBe('coral');
    expect(play.state.turn).toBe('blue');
    expect(() => play.do({ type: 'build', team: 'coral', plot: '1-2' })).toThrow(RuleError);
  });

  it('a team without a permit but with a crane gets a turn, and may use the crane or pass', () => {
    const play = startWith();
    play.state = give(play.state, 'coral', ['crane']);
    play.question(['blue']);
    expect(play.state.turn).toBe('coral');
    play.do({ type: 'card/crane', team: 'coral' }).do({ type: 'build', team: 'coral', plot: '1-2' });
    expect(play.state.turn).toBe('blue');

    const other = startWith();
    other.state = give(other.state, 'coral', ['crane']);
    other.question(['blue']).do({ type: 'turn/pass', team: 'coral' });
    expect(other.state.turn).toBe('blue');
    expect(other.state.teams.coral.cards).toEqual(['crane']);
  });

  it('a crane gives a team with a permit a second move', () => {
    const play = startWith();
    play.state = give(play.state, 'coral', ['crane']);
    play.question(['coral']).build({ coral: ['1-2', 'crane', '1-3'] });
    expect(play.state.teams.coral.moveCount).toBe(2);
  });

  it('a team with a permit and no available plot is passed over (decision)', () => {
    // Coral's base is boxed in by blue plots built today, which can't be auctioned yet.
    const play = startWith({ blue: [['1-2', 1], ['2-1', 1]] }).question(['coral', 'blue']);
    expect(play.state.turn).toBe('blue');
  });
});

describe('what the screens offer', () => {
  it('lists the plots to build, bridge (only with a usable bridge card) and auction', () => {
    const play = startWith({ coral: ['5-5'], blue: ['5-4'] });
    const before = options(play.state, 'coral');
    expect(before.build).toContain('4-5');
    expect(before.auction).toEqual(['5-4']);
    expect(before.bridge).toEqual([]);
    play.state = give(play.state, 'coral', ['bridge']);
    expect(options(play.state, 'coral').bridge).toContain('5-7');
  });

  it('counts the questions left in the file', () => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' });
    expect(questionsLeft(play.state)).toBe(11); // 12 in the sample, one taken for day 1
    play.do({ type: 'question/replace' });
    expect(questionsLeft(play.state)).toBe(10);
  });
});

describe('the question', () => {
  it('the referee chooses individual or group each day; individual shows the numbers first', () => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' });
    expect(play.state.question.kind).toBeNull();
    expect(() => play.do({ type: 'question/show' })).toThrow(RuleError);
    expect(() => play.do({ type: 'numbers/show' })).toThrow(RuleError);
    play.do({ type: 'question/kind', kind: 'group' }).do({ type: 'question/kind', kind: 'individual' });
    expect(() => play.do({ type: 'question/show' })).toThrow(RuleError);
    play.do({ type: 'numbers/show' });
    expect(play.state.question.numbers).toEqual({ coral: 1, blue: 1, green: 1, gold: 1 });
    expect(() => play.do({ type: 'question/kind', kind: 'group' })).toThrow(RuleError); // fixed once the numbers are out
    play.do({ type: 'question/show' }).do({ type: 'answer/show' }).do({ type: 'permits/set', teams: [] }).endDay();
    expect(play.state.question.kind).toBeNull();
    play.do({ type: 'question/kind', kind: 'group' });
    expect(() => play.do({ type: 'numbers/show' })).toThrow(RuleError);
    play.do({ type: 'question/show' });
    expect(play.state.step).toBe('asking');
    expect(() => play.do({ type: 'question/kind', kind: 'individual' })).toThrow(RuleError);
  });

  it('an individual question gives one permit, a group question one to every right answer', () => {
    const individual = new Play(sampleSetup()).do({ type: 'game/start' }).do({ type: 'question/kind', kind: 'individual' });
    individual.do({ type: 'numbers/show' }).do({ type: 'question/show' }).do({ type: 'answer/show' });
    expect(() => individual.do({ type: 'permits/set', teams: ['coral', 'blue'] })).toThrow(RuleError);
    individual.do({ type: 'permits/set', teams: ['blue'] });
    expect(individual.state.permits).toEqual(['blue']);

    const group = new Play(sampleSetup()).do({ type: 'game/start' }).question(['coral', 'blue', 'gold'], 'group');
    expect(group.state.permits).toEqual(['coral', 'blue', 'gold']);
  });

  it('once the file runs out, the referee asks a question of their own, with the timer', () => {
    const setup = { ...sampleSetup(), questions: [] };
    const play = new Play(setup).do({ type: 'game/start' }).do({ type: 'question/kind', kind: 'individual' });
    expect(() => play.do({ type: 'question/outside' })).toThrow(RuleError); // the numbers first
    play.do({ type: 'numbers/show' });
    expect(() => play.do({ type: 'question/show' })).toThrow(RuleError);
    play.do({ type: 'question/outside' });
    expect(play.state).toMatchObject({ step: 'asking', question: { outside: true } });
    expect(play.state.timer?.kind).toBe('question');
    expect(currentQuestion(play.state)).toBeNull();
    play.do({ type: 'answer/show' }).do({ type: 'permits/set', teams: ['coral'] });
    expect(play.state.step).toBe('build');
  });

  it('while the file has a question, there is no question from outside', () => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' }).do({ type: 'question/kind', kind: 'group' });
    expect(() => play.do({ type: 'question/outside' })).toThrow(RuleError);
  });

  it('a reopened referee window restarts a running timer from the full time', () => {
    const play = asking();
    const started = play.state.timer!.startedAt;
    play.do({ type: 'timer/restart' });
    expect(play.state.timer!.startedAt).toBeGreaterThan(started);
    play.do({ type: 'answer/show' });
    expect(() => play.do({ type: 'timer/restart' })).toThrow(RuleError);
  });

  it('the timer running out shows the answer', () => {
    const play = asking();
    expect(play.state.timer?.kind).toBe('question');
    play.do({ type: 'timer/end' });
    expect(play.state).toMatchObject({ step: 'answer', timer: null });
  });

  it('replace brings the next question with the same numbers, and questions never come back', () => {
    const play = new Play(sampleSetup())
      .do({ type: 'game/start' })
      .do({ type: 'question/kind', kind: 'individual' })
      .do({ type: 'numbers/show' });
    const numbers = play.state.question.numbers;
    expect(currentQuestion(play.state)?.text).toBe('كم عدد أيام الأسبوع؟');
    play.do({ type: 'question/replace' });
    expect(currentQuestion(play.state)?.text).toBe('ما عاصمة المملكة العربية السعودية؟');
    expect(play.state.question.numbers).toEqual(numbers);
    play.do({ type: 'question/show' }).do({ type: 'answer/show' }).do({ type: 'permits/set', teams: [] }).endDay();
    expect(currentQuestion(play.state)?.text).toBe('كم ضلعاً للمثلث؟');
  });
});

/** Day 1, an individual question on screen with its timer running. */
function asking(): Play {
  return new Play(sampleSetup())
    .do({ type: 'game/start' })
    .do({ type: 'question/kind', kind: 'individual' })
    .do({ type: 'numbers/show' })
    .do({ type: 'question/show' });
}
