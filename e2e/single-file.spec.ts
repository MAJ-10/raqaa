import { readFileSync } from 'node:fs';
import {
  SINGLE_FILE,
  SYNC_MODES,
  checkDisplayAlone,
  checkSync,
  createRoom,
  expect,
  fillSetup,
  fontsLoaded,
  outside,
  singleFileUrl,
  test,
} from './fixtures.ts';

test.describe('single file (raqaa.html)', () => {
  for (const { search, label } of SYNC_MODES) {
    test(`the two windows stay in sync${label}`, async ({ page }) => {
      await checkSync(page, singleFileUrl(search), singleFileUrl(`${search}#display`));
    });
  }

  test('the display shows the competition while the referee window is closed', async ({ page }) => {
    await checkDisplayAlone(page, singleFileUrl());
  });

  test('makes no network requests', async ({ page, requests }) => {
    await checkSync(page, singleFileUrl(), singleFileUrl('#display'));
    expect(requests.length).toBeGreaterThan(0);
    expect(outside(requests, 'file:')).toEqual([]);
  });

  test('is one self-contained page that forbids network access', () => {
    const html = readFileSync(SINGLE_FILE, 'utf8');
    expect(html).not.toMatch(/<script[^>]*\ssrc=/);
    expect(html).not.toMatch(/<link[^>]*\shref="(?!data:)/);
    expect(html).not.toMatch(/rel="manifest"/);
    expect(html).toContain("connect-src 'none'");
  });

  test('reads the questions file and starts, from the local file', async ({ page, requests }) => {
    await createRoom(page, singleFileUrl());
    await fillSetup(page);
    await page.getByRole('button', { name: 'ابدأ' }).click();
    await expect(page.getByRole('heading', { name: 'اليوم ١ من ١٢' })).toBeVisible();
    expect(outside(requests, 'file:')).toEqual([]);
  });

  test('has the fonts inside it', async ({ page }) => {
    await page.goto(singleFileUrl());
    await expect(page.getByRole('button', { name: 'إنشاء غرفة' })).toBeVisible();
    expect(await fontsLoaded(page)).toEqual([true, true, true]);
  });
});
