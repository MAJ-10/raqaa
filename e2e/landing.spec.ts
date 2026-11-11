// The landing page: the first page when no competition is saved, and at «#landing» at any time.
import type { Page } from '@playwright/test';
import { fourDays } from '../src/engine/scenarios.ts';
import { expect, nameField, seedGame, test } from './fixtures.ts';

/** Scrolls the page so the element's top sits at this share of the window's height. */
const scrollTo = (page: Page, selector: string, share: number) =>
  page.evaluate(({ selector, share }) => {
    const top = document.querySelector(selector)!.getBoundingClientRect().top + scrollY;
    window.scrollTo(0, top - innerHeight * share);
  }, { selector, share });

const plot = (page: Page, id: string) => page.locator(`.land-iso [data-plot="${id}"]`);
const savedEvents = (page: Page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('raqaa.game') ?? '{"events":[]}') as { events: unknown[] }).events.length);

test.describe('landing page', () => {
  test('the scroll builds the city, and turns the cards over and back', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'ابنِ مدينتك وتصدّر الرقعة' })).toBeVisible();

    // The map starts on the first morning: the bases only.
    await scrollTo(page, '.land-map-track', 0);
    await expect(page.locator('.land-day')).toHaveText('اليوم ١');
    await expect(plot(page, '1-2')).not.toHaveAttribute('data-team');
    await expect(page.locator('.land-rings li[data-now]')).toContainText('البلدية');
    await expect(page.locator('.land-rings li').first()).toContainText('البلدية');

    // At the end of its track the city is built to the tower, and blue has won the plot beside it.
    await scrollTo(page, '.land-map-track', -2.9);
    await expect(page.locator('.land-day')).toHaveText('اليوم ٧');
    await expect(plot(page, '4-4')).toHaveAttribute('data-team', 'coral');
    await expect(plot(page, '3-4')).toHaveAttribute('data-team', 'blue');
    await expect(page.locator('.land-rings li[data-now]')).toContainText('برج الرقعة');
    await expect(page.getByRole('heading', { name: 'وأرض جارك تأخذها بالمزاد' })).toBeVisible();

    // Scrolling back takes the buildings away again.
    await scrollTo(page, '.land-map-track', 0);
    await expect(plot(page, '1-2')).not.toHaveAttribute('data-team');

    // A card lies face down until the page reaches it, and turns back when the page leaves it going up.
    const fence = page.locator('.land-table .land-card').first();
    await expect(fence).not.toHaveAttribute('data-up');
    await scrollTo(page, '.land-table', 0.3);
    await expect(fence).toHaveAttribute('data-up');
    await expect(fence.locator('figcaption')).toHaveCSS('opacity', '1');
    const mission = page.locator('.land-level .land-card').last();
    await expect(mission).not.toHaveAttribute('data-up');
    await scrollTo(page, '.land-map-track', -2);
    await expect(fence).not.toHaveAttribute('data-up');

    // Night falls as the page nears its end, and the podium is built when the page reaches it.
    const ending = page.locator('.land-create');
    await expect(ending).not.toHaveAttribute('data-night');
    await expect(page.getByTestId('podium')).toHaveCount(0);
    await scrollTo(page, '.land-podium', 0.2);
    await expect(mission).toHaveAttribute('data-up');
    await expect(ending).toHaveAttribute('data-night');
    await expect(page.getByTestId('podium')).toBeVisible();
    await expect(page.locator('.land-finale').getByAltText('مداد')).toBeVisible();

    // Going back up, day returns; the towers are built once, and stay.
    await scrollTo(page, '.land-table', 0.3);
    await expect(ending).not.toHaveAttribute('data-night');
    await expect(page.getByTestId('podium')).toHaveCount(1);

    // «إنشاء غرفة» at the end of the page opens the setup, at its top, with the maker's signature at its foot.
    await page.getByRole('button', { name: 'إنشاء غرفة' }).last().click();
    await expect(nameField(page, 'coral')).toBeVisible();
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await expect(page.getByAltText('مداد')).toBeVisible();
  });

  test('opens at «#landing» beside a saved competition, and never replaces it', async ({ page }) => {
    const { state, events } = fourDays();
    await seedGame(page, '/', state.setup, events);
    await expect(page.getByRole('heading', { name: 'اليوم ٥ من ٨' })).toBeVisible();

    await page.goto('/#landing');
    await expect(page.getByRole('heading', { level: 1, name: 'ابنِ مدينتك وتصدّر الرقعة' })).toBeVisible();
    expect(await savedEvents(page)).toBe(events.length);

    await page.getByRole('button', { name: 'مسابقة تجريبية' }).click();
    await expect(page.getByRole('heading', { name: 'اليوم ٥ من ٨' })).toBeVisible();
    expect(await savedEvents(page)).toBe(events.length);
  });
});
