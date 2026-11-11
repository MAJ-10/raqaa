// Phase 7: the demo competition plays itself on both screens, and the referee can pause and end it.
import { expect, openDisplay, test } from './fixtures.ts';

const savedEvents = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('raqaa.game') ?? '{"events":[]}') as { events: unknown[] }).events.length);

test('a demo competition plays itself on both screens, pauses, and ends back on the intro page', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'مسابقة تجريبية' }).click();
  await expect(page.getByRole('heading', { name: 'مسابقة تجريبية' })).toBeVisible();
  const display = await openDisplay(page);
  await page.bringToFront();
  await page.getByRole('button', { name: 'ابدأ', exact: true }).click();

  // It plays by itself: the question comes, then its answer, and the display follows.
  await expect.poll(() => savedEvents(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(5);
  await expect(display.getByText('الإجابة')).toBeVisible({ timeout: 30_000 });

  // «إيقاف» stops it where it is; «متابعة» goes on.
  await page.getByRole('button', { name: 'إيقاف' }).click();
  const paused = await savedEvents(page);
  await page.waitForTimeout(5000);
  expect(await savedEvents(page)).toBe(paused);
  await page.getByRole('button', { name: 'متابعة' }).click();
  await expect.poll(() => savedEvents(page), { timeout: 15_000 }).toBeGreaterThan(paused);

  // «إنهاء التجربة» drops it and goes back to the intro page.
  await page.getByRole('button', { name: 'إنهاء التجربة' }).click();
  await expect(page.getByRole('button', { name: 'إنشاء غرفة' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('raqaa.game'))).toBeNull();
});

test('a demo reopened halfway waits for «متابعة»', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'مسابقة تجريبية' }).click();
  await page.getByRole('button', { name: 'ابدأ', exact: true }).click();
  await expect.poll(() => savedEvents(page), { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
  await page.reload();
  await expect(page.getByRole('button', { name: 'متابعة' })).toBeVisible();
  const reopened = await savedEvents(page);
  await page.waitForTimeout(4000);
  expect(await savedEvents(page)).toBe(reopened);
});
