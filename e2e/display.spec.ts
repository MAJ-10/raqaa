// The display (Phase 5): the teams' boards, the map and the windows over the game follow the referee.
import type { Page } from '@playwright/test';
import { lastDayScenario, openAuctionScenario, Play, sampleSetup } from '../src/engine/scenarios.ts';
import type { ChallengeContent, GameEvent } from '../src/engine/types.ts';
import { expect, openDisplay, seedGame, test } from './fixtures.ts';

const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test.describe('display', () => {
  test('marks the permits, then leaves the map to the team in turn, its plots numbered on both screens', async ({ page }) => {
    const play = new Play(sampleSetup())
      .do({ type: 'game/start' })
      .do({ type: 'question/kind', kind: 'group' })
      .do({ type: 'question/show' })
      .do({ type: 'answer/show' });
    await seedGame(page, '/', play.state.setup, play.events);
    const display = await openDisplay(page);

    // The answer; once the permits are confirmed, each team is marked, and none fills.
    const answer = display.locator('[data-window="answer"]');
    await expect(answer.locator('.answer-value')).toHaveText('٧');
    const permits = page.locator('.permit-grid');
    await permits.getByRole('button', { name: 'الرواد' }).click();
    await permits.getByRole('button', { name: 'النجوم' }).click();
    await button(page, 'تأكيد التصاريح').click();
    await expect(answer.locator('.answer-right')).toHaveCount(2);
    await expect(answer.locator('.answer-wrong')).toHaveCount(2);
    await expect(answer.locator('[data-filled]')).toHaveCount(0);

    // A few seconds later the map shows: coral's board fills (no arrow), and the plots it can build on
    // carry the numbers its leader calls out, the same on the referee's map.
    await expect(display.locator('[data-window]')).toHaveCount(0, { timeout: 8000 });
    await expect(display.locator('.sign[data-team="coral"] .team-tile')).toHaveAttribute('data-filled');
    await expect(display.locator('.sign[data-team="blue"] .team-tile')).not.toHaveAttribute('data-filled');
    await expect(display.locator('.map-number')).toHaveText(['١', '٢']);
    await expect(page.locator('.plot[data-plot="1-2"] .plot-number')).toHaveText('١');
    await expect(page.locator('.plot[data-plot="2-1"] .plot-number')).toHaveText('٢');

    // Coral builds on «١»: blue's turn, with its own numbers.
    await page.locator('.plot[data-plot="1-2"]').click();
    await expect(display.locator('.sign[data-team="blue"] .team-tile')).toHaveAttribute('data-filled');
    await expect(display.locator('.display-map g[data-open]')).toHaveCount(2); // the two plots by its base
    await expect(display.locator('.display-map g[data-plot="1-2"]')).toHaveAttribute('data-team', 'coral');
    await expect(display.locator('.sign[data-team="coral"] .sign-population')).toHaveText('٣٠٠');
    await expect(page.locator('.plot[data-plot="1-8"] .plot-number')).toHaveText('١');
  });

  test('takes back what the referee undoes (criterion 16)', async ({ page }) => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' }).question(['coral']);
    await seedGame(page, '/', play.state.setup, play.events);
    const display = await openDisplay(page);
    await page.bringToFront();
    const plot = display.locator('.display-map g[data-plot="1-2"]');
    const population = display.locator('.sign[data-team="coral"] .sign-population');
    await expect(population).toHaveText('١٠٠');

    await page.locator('.plot[data-plot="1-2"]').click();
    await expect(plot).toHaveAttribute('data-team', 'coral');
    await expect(population).toHaveText('٣٠٠');

    await button(page, 'تراجع').click();
    await expect(plot).not.toHaveAttribute('data-team');
    await expect(population).toHaveText('١٠٠');
  });

  test('closed and opened again mid-game, shows the same moment (criterion 18)', async ({ page, context }) => {
    const { setup, events } = openAuctionScenario();
    await seedGame(page, '/', setup, events);
    const first = await openDisplay(page);
    const tally = (display: Page) => display.locator('[data-window="auction"] .duel-box[data-won]');
    await expect(tally(first)).toHaveCount(1);
    await first.close();

    const again = await context.newPage();
    await again.goto('/#display');
    await expect(again.locator('[data-window="auction"] .challenge-type')).toHaveText('بناء');
    await expect(tally(again)).toHaveCount(1);
  });

  test('keeps a challenge’s answer off the screen until the challenge ends (criterion 20)', async ({ page }) => {
    const { setup, events } = openAuctionScenario();
    // The scenario ends on a challenge just started; it becomes a sum with its answer.
    const start = events.at(-1) as Extract<GameEvent, { type: 'challenge/start' }>;
    const math: ChallengeContent = { type: 'math', start: 12, steps: [{ op: '+', n: 5 }], answer: 17 };
    await seedGame(page, '/', setup, [...events.slice(0, -1), { ...start, content: math }]);
    const display = await openDisplay(page);
    const result = display.locator('[data-window="auction"] .math-result');
    await expect(result).toHaveText('؟');

    await page.bringToFront();
    await page.getByRole('button', { name: 'فاز النجوم' }).click();
    await expect(result).toHaveText('١٧');
  });

  test('shows the numbers, then the question with each team’s number on its board and no timer', async ({ page }) => {
    const play = new Play(sampleSetup())
      .do({ type: 'game/start' })
      .do({ type: 'question/kind', kind: 'individual' })
      .do({ type: 'numbers/show' });
    await seedGame(page, '/', play.state.setup, play.events);
    const display = await openDisplay(page);

    await expect(display.locator('[data-window="numbers"] .team-tile-number')).toHaveText(['١', '١', '١', '١']);
    await button(page, 'عرض السؤال').click();
    const question = display.locator('[data-window="question"]');
    await expect(question).toContainText('كم عدد أيام الأسبوع؟');
    await expect(question).not.toContainText('فردي');
    await expect(question.locator('.timer')).toHaveCount(0);
    await expect(display.locator('.sign-number')).toHaveText(['رقم ١', 'رقم ١', 'رقم ١', 'رقم ١']);
    // A display that reopens shows the same thing.
    await display.reload();
    await expect(display.locator('[data-window="question"]')).toContainText('كم عدد أيام الأسبوع؟');
  });

  test('keeps the numbers, the question and its answer in one card that changes, not one window after another', async ({ page }) => {
    const play = new Play(sampleSetup())
      .do({ type: 'game/start' })
      .do({ type: 'question/kind', kind: 'individual' })
      .do({ type: 'numbers/show' });
    await seedGame(page, '/', play.state.setup, play.events);
    const display = await openDisplay(page);
    const card = await display.locator('[data-window="numbers"]').elementHandle();

    await button(page, 'عرض السؤال').click();
    await expect(display.locator('[data-window="question"]')).toContainText('كم عدد أيام الأسبوع؟');
    await button(page, 'عرض الإجابة').click();
    const answer = display.locator('[data-window="answer"]');
    await expect(answer.locator('.answer-value')).toHaveText('٧');
    await expect(answer.locator('.question-words')).toHaveText('كم عدد أيام الأسبوع؟'); // the question stays over its answer
    expect(await card!.evaluate((node) => node.isConnected && node.getAttribute('data-window'))).toBe('answer'); // the same card all along
  });

  test('runs the timer of a group question', async ({ page }) => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' }).do({ type: 'question/kind', kind: 'group' });
    await seedGame(page, '/', play.state.setup, play.events);
    const display = await openDisplay(page);
    await button(page, 'عرض السؤال').click();
    await expect(display.locator('[data-window="question"] .timer')).toBeVisible();
    await expect(display.locator('[data-window="question"]')).not.toContainText('جماعي');
  });

  test('shows a card taken, large, then lets the game show again', async ({ page }) => {
    // Coral reaches the fence on 2-3 on its third day.
    let play = new Play(sampleSetup()).do({ type: 'game/start' });
    play = play.question(['coral']).build({ coral: ['1-2'] }).endDay().question(['coral']).build({ coral: ['2-2'] }).endDay();
    play.question(['coral']);
    await seedGame(page, '/', play.state.setup, play.events);
    const display = await openDisplay(page);

    await page.locator('.plot[data-plot="2-3"]').click();
    const card = display.locator('[data-window="card"]');
    await expect(card).toContainText('الرواد كسب السياج');
    await expect(display.locator('.sign[data-team="blue"]')).toHaveAttribute('data-faded');
    await expect(card).toHaveCount(0, { timeout: 8000 });
    await expect(display.locator('.sign[data-team="coral"] .sign-cards .icon')).toHaveCount(1);
  });

  test('shows the auction: the two sides, the challenges won, the challenge being played', async ({ page }) => {
    const { setup, events } = openAuctionScenario();
    await seedGame(page, '/', setup, events);
    const display = await openDisplay(page);

    const auction = display.locator('[data-window="auction"]');
    await expect(auction.locator('.duel-side')).toHaveText([/الرواد/, /النجوم/]);
    await expect(auction.locator('.duel-boxes[data-team="coral"] .duel-box[data-won]')).toHaveCount(1);
    await expect(auction.locator('.duel-boxes[data-team="blue"] .duel-box[data-won]')).toHaveCount(0);
    await expect(auction.locator('.challenge-number')).toHaveText('التحدي ٢');
    await expect(auction.locator('.challenge-type')).toHaveText('بناء');
    await expect(auction.locator('.timer')).toBeVisible();
  });

  test('announces at night, mission by mission, and ends on the podium', async ({ page }) => {
    const { setup, events } = lastDayScenario();
    await seedGame(page, '/', setup, events);
    const display = await openDisplay(page);
    // The last days hide the population; the announcement shows it again, at night.
    await expect(display.locator('.sign-population')).toHaveCount(0);
    await button(page, 'الإعلان').click();
    await expect(display.locator('.stage-viewport[data-night]')).toHaveCount(1);
    await expect(display.locator('.display-title')).toHaveText('سكان الخريطة');
    await expect(display.locator('.sign-population')).toHaveCount(4);

    // A mission shows beside the map, not over it: the map stays in full view, making room for the strip,
    // and the mission's team stands out while the others dim.
    await button(page, 'التالي').click();
    await expect(display.locator('[data-window="mission"]')).toContainText('برج الرقعة');
    await expect(display.locator('.display-game')).not.toHaveAttribute('data-dimmed');
    await expect(display.locator('.display-map')).toHaveClass(/display-map-room/);
    await expect(display.locator('.display-map g[data-team="coral"][data-dim]')).toHaveCount(0);
    await expect(display.locator('.display-map g[data-team="blue"][data-dim]')).not.toHaveCount(0);

    while (await button(page, 'التالي').isVisible()) await button(page, 'التالي').click();
    const podium = display.getByTestId('podium');
    await expect(podium.locator('[data-tower]')).toHaveCount(4);
    await expect(podium.locator('.podium-crown')).not.toHaveCount(0);
    await expect(podium.locator('.podium-title')).toHaveText('عمدة الرقعة');
    // Each tower is built of its floors, the first the tallest.
    const winner = await podium.locator('.podium-labels:has(.podium-crown)').first().getAttribute('data-label');
    await expect(podium.locator(`[data-tower="${winner}"] [data-floor]`)).toHaveCount(8);
  });

  test('moves only when motion is welcome: with reduced motion, a build changes the display at once', async ({ page }) => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' }).question(['coral']);
    await seedGame(page, '/', play.state.setup, play.events);
    const display = await openDisplay(page);
    await display.emulateMedia({ reducedMotion: 'reduce' });
    await display.reload();
    await expect(display.locator('.display-map g[data-open]')).toHaveCount(2);
    await page.locator('.plot[data-plot="1-2"]').click();
    await expect(display.locator('.display-map g[data-plot="1-2"]')).toHaveAttribute('data-team', 'coral');
    expect(await display.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
  });

  test('the referee mutes the display’s sounds, and the choice stays after a reload', async ({ page }) => {
    const play = new Play(sampleSetup()).do({ type: 'game/start' });
    await seedGame(page, '/', play.state.setup, play.events);
    const mute = page.getByRole('button', { name: 'كتم الصوت' });
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.getByRole('button', { name: 'كتم الصوت' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('hides the population in the last days, and keeps the cards', async ({ page }) => {
    let play = new Play(sampleSetup(9, 4)).do({ type: 'game/start' });
    for (let day = 0; day < 2; day++) play = play.question([]).endDay();
    await seedGame(page, '/', play.state.setup, play.events); // day 3 of 4
    const display = await openDisplay(page);
    await expect(display.locator('.sign')).toHaveCount(4);
    await expect(display.locator('.sign-population')).toHaveCount(0);
  });
});
