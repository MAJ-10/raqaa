// The referee's play screen on the website: a day through the UI, then auctions, cards and the end
// from ready-made scenarios.
import { lastDayScenario, openAuctionScenario, planScenario, Play, sampleSetup } from '../src/engine/scenarios.ts';
import type { Team } from '../src/engine/types.ts';
import { createRoom, expect, fillSetup, openDisplay, seedGame, test } from './fixtures.ts';

const heading = (page: import('@playwright/test').Page, name: string) => page.getByRole('heading', { name });
const button = (page: import('@playwright/test').Page, name: string | RegExp, options: { exact?: boolean } = {}) =>
  page.getByRole('button', { name, ...options });
/** The step of the day the track has open now. */
const currentStep = (page: import('@playwright/test').Page) => page.locator('.track-step[aria-current="step"] h2');

test.describe('play', () => {
  test('a whole day: an individual question, one permit, building, day end, undo', async ({ page }) => {
    await createRoom(page, '/');
    await fillSetup(page);
    const display = await openDisplay(page);
    await button(page, 'ابدأ').click();
    // The window over the game on the display: the numbers, then the question, then the answer.
    const shown = display.locator('[data-window]');

    // The referee chooses the kind first, and only then sees the question; «إنهاء المسابقة» waits for
    // the end of the day.
    await expect(currentStep(page)).toHaveText('طلب البناء');
    await expect(button(page, 'إنهاء المسابقة')).toHaveCount(0);
    await expect(page.locator('.question')).toHaveCount(0);
    await expect(button(page, 'عرض السؤال')).toHaveCount(0);
    await page.getByRole('radio', { name: 'فردي' }).click();
    await expect(page.locator('.question-text')).toHaveText('كم عدد أضلاع الشكل السداسي؟');
    // An individual question shows the numbers first, in place of «عرض السؤال» and «تبديل».
    await expect(button(page, 'عرض السؤال')).toHaveCount(0);
    await expect(button(page, 'تبديل')).toHaveCount(0);
    await button(page, 'عرض الأرقام').click();
    await expect(page.getByRole('list', { name: 'أرقام اللاعبين' }).getByRole('listitem')).toHaveCount(4);
    // The kind is fixed once the numbers are out: the choice gives way to a label by the step's title.
    await expect(page.getByRole('radio', { name: 'جماعي' })).toHaveCount(0);
    await expect(page.locator('.track-step:nth-child(1) .track-summary')).toHaveText('فردي');
    await expect(shown).toHaveAttribute('data-window', 'numbers');
    await expect(shown).not.toContainText('أضلاع');
    await button(page, 'عرض السؤال').click();
    await expect(shown).toContainText('كم عدد أضلاع الشكل السداسي؟');
    await expect(shown).not.toContainText('٦');

    // The permits wait, dimmed, for the answer. Then one permit: pressing a second team moves it there.
    const permits = page.locator('.permit-grid');
    await expect(permits.getByRole('button', { name: 'الرواد' })).toBeDisabled();
    await expect(button(page, 'تأكيد التصاريح')).toBeDisabled();
    await button(page, 'عرض الإجابة').click();
    await expect(shown).toContainText('٦');
    await expect(page.locator('.question-answer')).toHaveText('الإجابة: ٦');
    await permits.getByRole('button', { name: 'الرواد' }).click();
    await permits.getByRole('button', { name: 'النجوم' }).click();
    await expect(permits.getByRole('button', { name: 'الرواد' })).toHaveAttribute('aria-pressed', 'false');
    await button(page, 'تأكيد التصاريح').click();

    await expect(page.locator('.build-row[data-status="turn"]')).toContainText('النجوم');
    await page.locator('.plot[data-choice]').first().click();

    await expect(currentStep(page)).toHaveText('ختام اليوم');
    await expect(page.locator('.track-step:nth-child(3) .track-summary')).toHaveText('مبنى واحد');
    // The day's tally: النجوم built, so it comes first, in green; the others did not change.
    const tally = page.locator('.tally-list li');
    await expect(tally.first()).toContainText('النجوم');
    await expect(tally.first().locator('.tally-gain[data-sign="up"]')).toHaveText(/^\+[٢٣٤]٠٠$/);
    await expect(page.locator('.tally-same')).toHaveCount(3);
    await expect(button(page, 'إنهاء المسابقة')).toBeVisible();
    await button(page, 'اليوم التالي').click();
    await expect(heading(page, 'اليوم ٢ من ١٢')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'فردي' })).toHaveAttribute('aria-checked', 'false');

    await button(page, 'تراجع').click();
    await expect(currentStep(page)).toHaveText('ختام اليوم');
    await button(page, 'السجل').click();
    await expect(page.locator('.log-list li').first()).toContainText('النجوم بنى');
  });

  test('a group question gives a permit to every right answer', async ({ page }) => {
    const fresh = new Play(sampleSetup()).do({ type: 'game/start' });
    await seedGame(page, '/', fresh.state.setup, fresh.events);
    await page.getByRole('radio', { name: 'جماعي' }).click();
    await expect(button(page, 'عرض الأرقام')).toHaveCount(0);
    await button(page, 'عرض السؤال').click();
    await button(page, 'عرض الإجابة').click();
    const permits = page.locator('.permit-grid');
    await permits.getByRole('button', { name: 'الرواد' }).click();
    await permits.getByRole('button', { name: 'النجوم' }).click();
    await button(page, 'تأكيد التصاريح').click();
    await expect(page.locator('.build-row', { hasText: 'بدون تصريح' })).toHaveCount(2);
  });

  test('a group question runs out after 20 seconds and the answer shows; an individual one has no timer', async ({ page }) => {
    await page.clock.install();
    const fresh = new Play(sampleSetup()).do({ type: 'game/start' }).do({ type: 'question/kind', kind: 'group' });
    await seedGame(page, '/', fresh.state.setup, fresh.events);
    await button(page, 'عرض السؤال').click();
    await expect(page.locator('.timer-number')).toHaveText('٢٠');
    await expect(button(page, 'تأكيد التصاريح')).toBeDisabled();
    await page.clock.fastForward(21_000);
    await expect(button(page, 'تأكيد التصاريح')).toBeEnabled();

    const individual = new Play(sampleSetup())
      .do({ type: 'game/start' })
      .do({ type: 'question/kind', kind: 'individual' })
      .do({ type: 'numbers/show' })
      .do({ type: 'question/show' });
    await seedGame(page, '/', individual.state.setup, individual.events);
    await expect(button(page, 'عرض الإجابة')).toBeVisible();
    await expect(page.locator('.timer')).toHaveCount(0);
  });

  test('once the file runs out, a question from outside it', async ({ page }) => {
    const fresh = new Play({ ...sampleSetup(), questions: [] }).do({ type: 'game/start' });
    await seedGame(page, '/', fresh.state.setup, fresh.events);
    const display = await openDisplay(page);
    await expect(page.locator('.question')).toHaveCount(0); // the kind first
    await page.getByRole('radio', { name: 'جماعي' }).click();
    await expect(page.locator('.question-text')).toHaveText('انتهت أسئلة الملف');
    await button(page, 'سؤال من خارج الملف').click();
    await expect(page.locator('.question-text')).toHaveText('سؤال من خارج الملف');
    await expect(display.locator('[data-window="question"]')).toContainText('سؤال من الحكم');
    await button(page, 'عرض الإجابة').click();
    await expect(button(page, 'تأكيد التصاريح')).toBeEnabled();
  });

  test('ending before the last day asks first, then goes to the announcement', async ({ page }) => {
    const day = new Play(sampleSetup()).do({ type: 'game/start' }).question(['coral']).build({ coral: ['1-2'] });
    await seedGame(page, '/', day.state.setup, day.events);
    await expect(currentStep(page)).toHaveText('ختام اليوم');
    await button(page, 'إنهاء المسابقة').click(); // the small action in words
    await expect(page.getByText('تنتهي المسابقة الآن قبل آخر يوم')).toBeVisible();
    await button(page, 'إنهاء المسابقة').click(); // the confirmation
    await expect(page.locator('.announce-title')).toHaveText('سكان الخريطة');
    await expect(button(page, 'إنهاء المسابقة')).toHaveCount(0);
  });

  test('the fence cancels an auction at once', async ({ page }) => {
    // The open-auction scenario, stopped as coral declares on blue, who holds a fence.
    const { setup, events } = openAuctionScenario();
    const declared = events.findIndex((e) => e.type === 'auction/declare');
    await seedGame(page, '/', setup, events.slice(0, declared + 1));
    await expect(heading(page, 'السياج')).toBeVisible();
    await expect(page.locator('.plot[data-focus]')).toHaveAttribute('data-plot', '1-6'); // the plot in the spotlight
    await button(page, 'استخدم', { exact: true }).click();
    await expect(page.locator('.event-banner')).toContainText('النجوم استخدم السياج'); // the screen says so
    await expect(currentStep(page)).toHaveText('البناء');
    await expect(heading(page, 'السياج')).toHaveCount(0);
  });

  test('an auction is played challenge by challenge', async ({ page }) => {
    const { setup, events } = openAuctionScenario(); // coral leads 1–0, a building challenge is running
    await seedGame(page, '/', setup, events);
    await expect(currentStep(page)).toHaveText('المزادات');
    await expect(page.locator('.plot[data-focus]')).toHaveAttribute('data-plot', '1-6'); // the plot in the spotlight
    await button(page, 'فاز الرواد').click();
    await expect(page.locator('.event-banner')).toHaveText('الرواد فاز بالمزاد');
    await expect(currentStep(page)).toHaveText('ختام اليوم');
    await expect(page.locator('.plot[data-plot="1-6"]')).toHaveAttribute('data-team', 'coral');
  });

  test('a team holding a bridge sees the plots it reaches, and pressing one builds there', async ({ page }) => {
    const play = fourSmallDays().question(['coral']);
    await seedGame(page, '/', play.state.setup, play.events);
    const bridge = page.locator('.plot[data-bridge]');
    await expect(bridge.first()).toBeVisible();
    const id = await bridge.first().getAttribute('data-plot');
    await bridge.first().click();
    await expect(page.locator(`.plot[data-plot="${id}"]`)).toHaveAttribute('data-team', 'coral');
    await button(page, 'السجل').click();
    await expect(page.locator('.log-list li').first()).toContainText('بالجسر');
  });

  test('the inspector is used as soon as it is taken, and shows the missions with their pictures', async ({ page }) => {
    const play = fourSmallDays().question(['blue']);
    await seedGame(page, '/', play.state.setup, play.events);
    await page.locator('.plot[data-plot="4-5"]').click(); // the inspector's plot
    await expect(heading(page, 'مفتش البلدية')).toBeVisible();
    await button(page, 'الرواد', { exact: true }).click();
    // A window over the screen, with the missions' pictures; the referee closes it.
    const reveal = page.getByRole('dialog', { name: 'مشاريع الرواد' });
    await expect(reveal.locator('h2')).toHaveText('مشاريع الرواد');
    await expect(reveal.locator('.reveal-missions li')).toHaveText(['برج الرقعة', 'جامع البطاقات']);
    await expect(reveal.locator('.mission-art')).toHaveCount(2);
    await reveal.getByRole('button', { name: 'تم' }).click();
    await expect(reveal).toHaveCount(0);
    await page.locator('.team-card[data-team="blue"]').click();
    await expect(page.getByRole('dialog', { name: 'بطاقات النجوم' })).not.toContainText('مفتش البلدية'); // not kept
  });

  test('a plot shows its tip when the pointer rests on it', async ({ page }) => {
    const play = fourSmallDays().question(['coral']);
    await seedGame(page, '/', play.state.setup, play.events);
    const tip = page.locator('.plot[data-centre] .plot-tip');
    await page.locator('.plot[data-centre]').hover();
    await expect(tip).toHaveCSS('opacity', '1');
    await expect(tip).toContainText('برج الرقعة');
    await expect(tip.locator('.plot-tip-value')).toHaveText('٥٠٠'); // its worth in population
  });

  test('the map grows and shrinks with the screen, within limits', async ({ page }) => {
    const play = fourSmallDays();
    await seedGame(page, '/', play.state.setup, play.events);
    const width = async () => (await page.locator('.board-plate').boundingBox())!.width;
    await page.setViewportSize({ width: 1280, height: 720 });
    expect(await width()).toBeGreaterThanOrEqual(440);
    expect(await width()).toBeLessThan(500);
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect(await width()).toBeGreaterThan(780);
    await page.setViewportSize({ width: 2560, height: 1440 });
    expect(await width()).toBeLessThanOrEqual(940);
  });

  test('placing a plan shows the plots picked, on the map and in its two slots', async ({ page }) => {
    const play = fourSmallDays().question(['coral']);
    await seedGame(page, '/', play.state.setup, play.events);
    await page.locator('.plot[data-plot="3-4"]').click(); // the plan's plot
    await expect(heading(page, 'المخطط السري')).toBeVisible();
    await expect(button(page, 'تأكيد المخطط')).toBeDisabled();
    await page.locator('.plot[data-plot="1-3"]').click();
    await page.locator('.plot[data-plot="2-4"]').click();
    await expect(page.locator('.plot-picked')).toHaveCount(2);
    await expect(page.locator('.plan-slot[data-filled]')).toHaveCount(2);
    await button(page, 'تأكيد المخطط').click();
    await expect(page.locator('.plot[data-plot="1-3"] .plot-plan')).toBeVisible();
    await expect(page.locator('.plot[data-plot="2-4"] .plot-plan')).toBeVisible();
  });

  test('the referee sees the next challenge, with what it is, before starting it', async ({ page }) => {
    const { setup, events } = openAuctionScenario();
    await seedGame(page, '/', setup, events.slice(0, -1)); // before the second challenge starts
    const type = page.locator('.challenge h3');
    await expect(type).toHaveText(/حساب ذهني|تهجئة|ذاكرة|ترتيب|دقة|بناء/);
    const drawn = await type.textContent();
    await expect(page.locator('.challenge-hint')).not.toBeEmpty();
    await expect(page.locator('.timer')).toHaveCount(0);
    await button(page, 'تبديل').click(); // other content, the same type, before it starts
    await expect(type).toHaveText(drawn!);
    await button(page, 'ابدأ التحدي').click();
    await expect(type).toHaveText(drawn!); // the same challenge starts
    await expect(page.locator('.timer')).toBeVisible();
    await expect(button(page, 'فاز النجوم')).toBeVisible();
  });

  test('a plan that fires takes the plot the referee presses', async ({ page }) => {
    const { setup, events } = planScenario();
    await seedGame(page, '/', setup, events);
    const fired = page.locator('.decision-text');
    await expect(fired).toContainText('تفعّل مخطط');
    await expect(fired.locator('.team-name').first()).toHaveText('الرواد'); // the name on its team's colour
    await page.locator('.plot[data-plot="2-5"]').click();
    await expect(page.locator('.plot[data-plot="2-5"]')).toHaveAttribute('data-team', 'coral');
    await expect(currentStep(page)).toHaveText('ختام اليوم');
  });

  test('the last day ends in the announcement, then a new competition', async ({ page }) => {
    const { setup, events } = lastDayScenario();
    await seedGame(page, '/', setup, events);
    await button(page, 'الإعلان').click();
    await expect(page.locator('.announce-title')).toHaveText('سكان الخريطة');
    while (await button(page, 'التالي').isVisible()) await button(page, 'التالي').click();
    await expect(page.locator('.announce-title')).toHaveText('عمدة الرقعة');
    await button(page, 'مسابقة جديدة').click();
    await expect(page.getByText('تُحذف هذه المسابقة')).toBeVisible();
    await button(page, 'مسابقة جديدة').click(); // the confirmation
    await expect(button(page, 'إنشاء غرفة')).toBeVisible();
  });

  test('reopening the referee window restarts a running timer', async ({ page }) => {
    const asking = new Play(sampleSetup())
      .do({ type: 'game/start' })
      .do({ type: 'question/kind', kind: 'group' })
      .do({ type: 'question/show' });
    await seedGame(page, '/', asking.state.setup, asking.events);
    await button(page, 'السجل').click();
    await expect(page.locator('.log-list li').first()).toContainText('بدأ المؤقت من جديد');
    await expect(page.locator('.timer-number')).toHaveText('٢٠');
  });
});

/** A 7×7 game four days in: coral reaches 2-4 (and holds the bridge), next to the plan on 3-4; blue reaches 3-5, next to the inspector on 4-5. */
function fourSmallDays(): Play {
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
    .build({ coral: ['2-4'], blue: ['3-5'] }) // coral takes the bridge on 2-4
    .endDay();
}
