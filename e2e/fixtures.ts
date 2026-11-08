import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test as base, expect, type Page } from '@playwright/test';

export { expect };

export const SINGLE_FILE = resolve('dist/raqaa.html');
export const singleFileUrl = (suffix = '') => pathToFileURL(SINGLE_FILE).href + suffix;

/**
 * Every test records the address of every request the browser makes, and fails if any window logs an
 * error (which includes anything the security policy blocks).
 */
export const test = base.extend<{ requests: string[]; pageErrors: string[] }>({
  requests: async ({ context }, provide) => {
    const urls: string[] = [];
    context.on('request', (request) => urls.push(request.url()));
    await provide(urls);
  },
  pageErrors: [
    async ({ context }, provide) => {
      const errors: string[] = [];
      const watch = (page: Page) => {
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text());
        });
        page.on('pageerror', (error) => errors.push(String(error)));
      };
      context.pages().forEach(watch);
      context.on('page', watch);
      await provide(errors);
      expect(errors, 'errors logged by the app').toEqual([]);
    },
    { auto: true },
  ],
});

export const count = (page: Page) => page.getByTestId('count');

export async function add(referee: Page, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    await referee.getByRole('button', { name: 'إضافة' }).click();
  }
}

export async function openDisplay(referee: Page): Promise<Page> {
  const [display] = await Promise.all([
    referee.waitForEvent('popup'),
    referee.getByRole('button', { name: 'فتح شاشة العرض' }).click(),
  ]);
  await display.waitForLoadState();
  return display;
}

/**
 * The full sync story: the display follows the referee, survives a reload, opens from its own link,
 * and keeps up after the referee window reloads. `home` is the referee's address, `own` the display's.
 */
export async function checkSync(referee: Page, home: string, own: string): Promise<void> {
  await referee.goto(home);
  await expect(count(referee)).toHaveText('٠');

  const display = await openDisplay(referee);
  await expect(count(display)).toHaveText('٠');
  await add(referee, 3);
  await expect(count(display)).toHaveText('٣');

  await display.reload();
  await expect(count(display)).toHaveText('٣');

  await display.close();
  const fromLink = await referee.context().newPage();
  await fromLink.goto(own);
  await expect(count(fromLink)).toHaveText('٣');

  // The new page took the front; a page in the background answers clicks slowly, as in a hidden browser tab.
  await referee.bringToFront();
  await referee.reload();
  await expect(count(referee)).toHaveText('٣');
  await add(referee, 9);
  await expect(count(fromLink)).toHaveText('١٢');

  await referee.getByRole('button', { name: 'تراجع' }).click();
  await expect(count(referee)).toHaveText('١١');
  await expect(count(fromLink)).toHaveText('١١');
}
