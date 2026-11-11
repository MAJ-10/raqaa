// Phase 6: the display's sounds for each moment. All of them are shaped noise (see sound.ts): no notes.
import { describe, expect, it } from 'vitest';
import { cuesFor } from '../../src/display/cues.ts';
import { AUCTION_LAND, JUMP_DRAW } from '../../src/display/windows.ts';
import { fourSmallDays, lastDayScenario, openAuctionScenario, Play, sampleSetup } from '../../src/engine/scenarios.ts';
import { announcement } from '../../src/engine/missions.ts';
import { options } from '../../src/engine/select.ts';

const last = (play: Play) => play.events.at(-1)!;
const sounds = (play: Play) => cuesFor(play.state, last(play)).map((cue) => cue.sound);

describe('the display’s sounds', () => {
  it('puts a question on screen with a whoosh, and the numbers, the answer and the permits with a click', () => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' }).do({ type: 'question/kind', kind: 'individual' });
    expect(sounds(play.do({ type: 'numbers/show' }))).toEqual(['click']);
    expect(sounds(play.do({ type: 'question/show' }))).toEqual(['whoosh']);
    expect(sounds(play.do({ type: 'answer/show' }))).toEqual(['click']);
    expect(sounds(play.do({ type: 'permits/set', teams: ['coral'] }))).toEqual(['click']);
  });

  it('marks the end of a group question’s time', () => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' }).do({ type: 'question/kind', kind: 'group' }).do({ type: 'question/show' });
    expect(sounds(play.do({ type: 'timer/end' }))).toEqual(['timeUp']);
  });

  it('lands a building with a thud, and a card taken with a swish after it', () => {
    let play = new Play(sampleSetup()).do({ type: 'game/start' }).question(['coral']);
    play.do({ type: 'build', team: 'coral', plot: '1-2' });
    expect(cuesFor(play.state, last(play))).toEqual([{ sound: 'thud', after: 0.28 }]);
    // Coral reaches the fence on 2-3 on its third day.
    play = play.endDay().question(['coral']).build({ coral: ['2-2'] }).endDay().question(['coral']);
    play.do({ type: 'build', team: 'coral', plot: '2-3' });
    expect(sounds(play)).toEqual(['thud', 'swish']);
  });

  it('lets the bridge whoosh first, and the building land where its line arrives', () => {
    const play = fourSmallDays().question(['coral']);
    play.do({ type: 'build', team: 'coral', plot: options(play.state, 'coral').bridge[0]!, via: 'bridge' });
    const cues = cuesFor(play.state, last(play));
    expect(cues[0]).toEqual({ sound: 'swoosh', after: 0 });
    expect(cues[1]).toEqual({ sound: 'thud', after: JUMP_DRAW / 1000 + 0.28 });
  });

  it('knocks the gavel for an auction declared, pops for a challenge won, knocks it for the auction won, then lands its plot after the window', () => {
    const { setup, events } = openAuctionScenario();
    const play = new Play(setup);
    for (const e of events) play.do(e);
    const id = play.state.auctions.find((a) => a.status === 'open')!.id;
    expect(sounds(play.do({ type: 'challenge/result', auction: id, winner: 'blue' }))).toEqual(['pop']);
    play.do({ type: 'challenge/start', auction: id, content: { type: 'precision' } });
    const won = play.do({ type: 'challenge/result', auction: id, winner: 'coral' });
    expect(cuesFor(won.state, last(won))).toEqual([
      { sound: 'gavel', after: 0 },
      { sound: 'thud', after: (AUCTION_LAND + 280) / 1000 },
    ]);

    const declaring = new Play(sampleSetup()).do({ type: 'game/start' });
    expect(cuesFor(declaring.state, { at: 0, type: 'auction/declare', team: 'coral', plot: '1-2' })).toEqual([{ sound: 'knock', after: 0 }]);
  });

  it('tells each mission’s result in the announcement: a pop for done, a thud for failed', () => {
    const { setup, events } = lastDayScenario();
    const play = new Play(setup);
    for (const e of events) play.do(e);
    expect(sounds(play.do({ type: 'game/end' }))).toEqual(['whoosh']);
    play.do({ type: 'announce/next' });
    const step = announcement(play.state)[play.state.announce]!;
    if (step.kind !== 'mission') throw new Error('The second step is a mission');
    expect(sounds(play)).toEqual([step.result.done ? 'pop' : 'thud']);
  });
});
