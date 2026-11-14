import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import {
  SYNC_MODES,
  checkDisplayAlone,
  checkSync,
  createRoom,
  displayTeams,
  expect,
  fontsLoaded,
  nameField,
  openDisplay,
  outside,
  test,
} from './fixtures.ts';

const ORIGIN = 'http://localhost:4173';

test.describe('website', () => {
  for (const { search, label } of SYNC_MODES) {
    test(`the two windows stay in sync${label}`, async ({ page }) => {
      await checkSync(page, `/${search}`, `/${search}#display`);
    });
  }

  test('the display shows the competition while the referee window is closed', async ({ page }) => {
    await checkDisplayAlone(page, '/');
  });

  test('makes no requests outside the app', async ({ page, requests }) => {
    await checkSync(page, '/', '/#display');
    expect(requests.length).toBeGreaterThan(0);
    expect(outside(requests, `${ORIGIN}/`)).toEqual([]);
  });

  test('is Arabic, right to left, in Alexandria', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir])).toEqual(['ar', 'rtl']);
    expect(await fontsLoaded(page)).toEqual([true, true, true]);
  });

  test('installs as an app', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = (await (await request.get(new URL(href ?? '', `${ORIGIN}/`).href)).json()) as {
      name: string;
      display: string;
      icons: { src: string; sizes: string }[];
    };
    expect(manifest).toMatchObject({ name: 'رقعة', display: 'standalone' });
    expect(manifest.icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    for (const icon of manifest.icons) {
      expect((await request.get(`${ORIGIN}/${icon.src}`)).ok(), icon.src).toBe(true);
    }
    await page.evaluate(() => navigator.serviceWorker.ready);
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state)).toBe('activated');
  });

  test('works offline after the first visit', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.reload();
    expect(await fontsLoaded(page)).toEqual([true, true, true]);
    await createRoom(page, '/');
    const display = await openDisplay(page);
    await nameField(page, 'coral').fill('الرواد');
    await expect(displayTeams(display)).toContainText('الرواد');
  });

  test('an update waits until every window of the app is closed', async ({ page, context }) => {
    const file = resolve('dist/sw.js');
    const original = readFileSync(file, 'utf8');
    const version = /const VERSION = '([^']+)'/.exec(original)?.[1];
    expect(version).toBeTruthy();
    const registration = (p: Page) =>
      p.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return { active: reg?.active?.state ?? null, waiting: reg?.waiting?.state ?? null, caches: await caches.keys() };
      });
    try {
      await page.goto('/');
      await page.evaluate(() => navigator.serviceWorker.ready);
      await createRoom(page, '/');
      const display = await openDisplay(page);
      await nameField(page, 'coral').fill('الرواد');
      await expect(displayTeams(display)).toContainText('الرواد');

      // A new version is published while the competition is running.
      writeFileSync(file, original.replace(`const VERSION = '${version}'`, `const VERSION = '${version}-next'`));
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
      await expect.poll(async () => (await registration(page)).waiting).toBe('installed');

      // The running windows keep the old version, and keep working together.
      expect((await registration(page)).active).toBe('activated');
      await nameField(page, 'blue').fill('النجوم');
      await expect(displayTeams(display)).toContainText('النجوم');

      // Once every window is closed, the next open gets the new version, and the setup is where it was left.
      await display.close();
      await page.close();
      const reopened = await context.newPage();
      await reopened.goto('/');
      await expect.poll(async () => (await registration(reopened)).caches).toEqual([`raqaa-${version}-next`]);
      await reopened.getByRole('button', { name: 'إنشاء غرفة' }).first().click();
      await expect(nameField(reopened, 'blue')).toHaveValue('النجوم');
    } finally {
      writeFileSync(file, original);
    }
  });

  test('the display stage keeps 1280×720 proportions and fills a 16:9 screen', async ({ page }) => {
    const box = async () => {
      const b = await page.getByTestId('stage').boundingBox();
      return b && [b.x, b.y, b.width, b.height].map(Math.round);
    };
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/#display');
    await expect.poll(box).toEqual([0, 0, 1920, 1080]);
    // A 5:4 screen: the stage keeps its proportions, with sky above and below.
    await page.setViewportSize({ width: 1280, height: 1024 });
    await expect.poll(box).toEqual([0, 152, 1280, 720]);
  });

  test('the first click makes the display fullscreen', async ({ page }) => {
    await page.goto('/#display');
    await page.getByTestId('stage').click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  });
});
