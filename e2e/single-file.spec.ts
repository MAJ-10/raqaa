import { readFileSync } from 'node:fs';
import { SINGLE_FILE, checkDisplayAlone, checkSync, count, expect, singleFileUrl, test } from './fixtures.ts';

test.describe('single file (raqaa.html)', () => {
  for (const sync of ['', '?sync=broadcast', '?sync=storage']) {
    test(`the two windows stay in sync${sync ? ` (${sync.slice('?sync='.length)} alone)` : ''}`, async ({ page }) => {
      await checkSync(page, singleFileUrl(sync), singleFileUrl(`${sync}#display`));
    });
  }

  test('the display shows the competition while the referee window is closed', async ({ page }) => {
    await checkDisplayAlone(page, singleFileUrl());
  });

  test('makes no network requests', async ({ page, requests }) => {
    await checkSync(page, singleFileUrl(), singleFileUrl('#display'));
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.filter((url) => !url.startsWith('file:') && !url.startsWith('data:'))).toEqual([]);
  });

  test('is one self-contained page that forbids network access', () => {
    const html = readFileSync(SINGLE_FILE, 'utf8');
    expect(html).not.toMatch(/<script[^>]*\ssrc=/);
    expect(html).not.toMatch(/<link[^>]*\shref="(?!data:)/);
    expect(html).not.toMatch(/rel="manifest"/);
    expect(html).toContain("connect-src 'none'");
  });

  test('has the fonts inside it', async ({ page }) => {
    await page.goto(singleFileUrl());
    await expect(count(page)).toHaveText('٠');
    const loaded = await page.evaluate(async () => {
      const faces = await Promise.all(['400', '600', '900'].map((w) => document.fonts.load(`${w} 20px Alexandria`)));
      return faces.map((list) => list.length > 0 && list.every((face) => face.status === 'loaded'));
    });
    expect(loaded).toEqual([true, true, true]);
  });
});
