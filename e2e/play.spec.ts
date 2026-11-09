// The referee's play screen on the website: a day through the UI, then auctions, cards and the end
// from ready-made scenarios.
import { lastDayScenario, openAuctionScenario, planScenario, Play, sampleSetup } from '../src/engine/scenarios.ts';
import { createRoom, expect, fillSetup, openDisplay, seedGame, test } from './fixtures.ts';

const heading = (page: import('@playwright/test').Page, name: string) => page.getByRole('heading', { name });
const button = (page: import('@playwright/test').Page, name: string | RegExp) => page.getByRole('button', { name });

test.describe('play', () => {
  test('a whole day: question, permits, building, day end, undo', async ({ page }) => {
    await createRoom(page, '/');
    await fillSetup(page);
    const display = await openDisplay(page);
    await button(page, 'ابدأ').click();

    await button(page, 'عرض الأرقام').click();
    await expect(page.locator('.numbers-grid')).toContainText('رقم ١');
    await expect(display.getByTestId('display-plain')).not.toContainText('أضلاع');
    await button(page, 'عرض السؤال').click();
    await expect(display.getByTestId('display-plain')).toContainText('كم عدد أضلاع الشكل السداسي؟');
    await expect(display.getByTestId('display-plain')).not.toContainText('٦');
    await button(page, 'عرض الإجابة').click();
    await expect(display.getByTestId('display-plain')).toContainText('٦');

    await page.locator('.permit-grid').getByRole('button', { name: 'الرواد' }).click();
    await page.locator('.permit-grid').getByRole('button', { name: 'النجوم' }).click();
    await button(page, 'تأكيد التصاريح').click();

    // Coral moves first (day 1 order), then blue: each presses one of its dashed plots.
    await expect(page.locator('.build-row[data-status="turn"]')).toContainText('الرواد');
    await page.locator('.plot[data-choice]').first().click();
    await expect(page.locator('.build-row[data-status="turn"]')).toContainText('النجوم');
    await page.locator('.plot[data-choice]').first().click();

    await expect(heading(page, 'نهاية اليوم ١')).toBeVisible();
    await expect(page.getByText('مبنيان جديدان')).toBeVisible();
    await button(page, 'اليوم الجاي').click();
    await expect(heading(page, 'اليوم ٢ من ١٢')).toBeVisible();
    await expect(page.locator('.chip', { hasText: 'جماعي' })).toBeVisible();

    await button(page, 'تراجع').click();
    await expect(heading(page, 'نهاية اليوم ١')).toBeVisible();
    await button(page, 'السجل').click();
    await expect(page.locator('.log-list li').first()).toContainText('النجوم بنى');
  });

  test('the timer runs out by itself and the answer shows', async ({ page }) => {
    await page.clock.install();
    const fresh = new Play(sampleSetup()).do({ type: 'game/start' }).do({ type: 'numbers/show' });
    await seedGame(page, '/', fresh.state.setup, fresh.events);
    await button(page, 'عرض السؤال').click();
    await page.clock.fastForward(46_000);
    await expect(heading(page, 'التصاريح')).toBeVisible();
  });

  test('a question from outside the file', async ({ page }) => {
    const fresh = new Play(sampleSetup()).do({ type: 'game/start' }).do({ type: 'numbers/show' });
    await seedGame(page, '/', fresh.state.setup, fresh.events);
    const display = await openDisplay(page);
    await button(page, 'سؤال من خارج الملف').click();
    await expect(page.locator('.question-text')).toHaveText('سؤال من خارج الملف');
    await expect(display.getByTestId('display-plain')).toContainText('سؤال من الحكم');
    await button(page, 'عرض الإجابة').click();
    await expect(heading(page, 'التصاريح')).toBeVisible();
  });

  test('the fence cancels an auction at once', async ({ page }) => {
    // The open-auction scenario, stopped as coral declares on blue, who holds a fence.
    const { setup, events } = openAuctionScenario();
    const declared = events.findIndex((e) => e.type === 'auction/declare');
    await seedGame(page, '/', setup, events.slice(0, declared + 1));
    await expect(heading(page, 'السياج')).toBeVisible();
    await button(page, 'استخدم السياج').click();
    await expect(heading(page, 'البناء')).toBeVisible();
  });

  test('an auction is played challenge by challenge', async ({ page }) => {
    const { setup, events } = openAuctionScenario(); // coral leads 1–0, a building challenge is running
    await seedGame(page, '/', setup, events);
    await expect(heading(page, 'المزادات')).toBeVisible();
    await button(page, 'فاز الرواد').click();
    await expect(heading(page, 'نهاية اليوم ٥')).toBeVisible();
    await expect(page.locator('.plot[data-plot="1-6"]')).toHaveAttribute('data-team', 'coral');
  });

  test('starting a challenge shows its content to the referee', async ({ page }) => {
    const { setup, events } = openAuctionScenario();
    await seedGame(page, '/', setup, events.slice(0, -1)); // before the second challenge starts
    await button(page, 'ابدأ التحدي').click();
    await expect(page.locator('.challenge h3')).toHaveText(/حساب ذهني|تهجئة|ذاكرة|ترتيب|دقة|بناء/);
    await expect(button(page, 'فاز النجوم')).toBeVisible();
  });

  test('a plan that fires takes the plot the referee presses', async ({ page }) => {
    const { setup, events } = planScenario();
    await seedGame(page, '/', setup, events);
    await expect(page.getByText(/اشتغل مخطط الرواد/)).toBeVisible();
    await page.locator('.plot[data-plot="2-5"]').click();
    await expect(page.locator('.plot[data-plot="2-5"]')).toHaveAttribute('data-team', 'coral');
    await expect(heading(page, 'نهاية اليوم ٦')).toBeVisible();
  });

  test('the last day ends in the announcement, then a new competition', async ({ page }) => {
    const { setup, events } = lastDayScenario();
    await seedGame(page, '/', setup, events);
    await button(page, 'الإعلان').click();
    await expect(page.locator('.announce-title')).toHaveText('سكان الخريطة');
    while (await button(page, 'التالي').isVisible()) await button(page, 'التالي').click();
    await expect(page.locator('.announce-title')).toHaveText('عمدة الرقعة');
    page.once('dialog', (dialog) => dialog.accept());
    await button(page, 'مسابقة جديدة').click();
    await expect(button(page, 'إنشاء غرفة')).toBeVisible();
  });

  test('reopening the referee window restarts a running timer', async ({ page }) => {
    const asking = new Play(sampleSetup()).do({ type: 'game/start' }).do({ type: 'numbers/show' }).do({ type: 'question/show' });
    await seedGame(page, '/', asking.state.setup, asking.events);
    await button(page, 'السجل').click();
    await expect(page.locator('.log-list li').first()).toContainText('بدأ المؤقت من أوله');
    await expect(page.locator('.timer-number')).toHaveText('٤٥');
  });
});
