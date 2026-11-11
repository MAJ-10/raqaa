import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test as base, expect, type Page } from '@playwright/test';
import type { GameEvent, Setup, Team } from '../src/engine/types.ts';
import { SCHEMA_VERSION } from '../src/state/persist.ts';
import { TEAM_COLOUR } from '../src/ui/team-colour.ts';

export { expect };

export const SINGLE_FILE = resolve('dist/raqaa.html');
export const singleFileUrl = (suffix = '') => pathToFileURL(SINGLE_FILE).href + suffix;
export const SAMPLE_QUESTIONS = resolve('samples/questions-sample.csv');

/** Both sync transports together, then each alone. */
export const SYNC_MODES = [
  { search: '', label: '' },
  { search: '?sync=broadcast', label: ' (broadcast alone)' },
  { search: '?sync=storage', label: ' (storage alone)' },
];

/** Requests that left the app: anything not under one of these address beginnings, or a data: URL. */
export const outside = (requests: string[], ...own: string[]) =>
  requests.filter((url) => !url.startsWith('data:') && !own.some((start) => url.startsWith(start)));

/** Whether the three Alexandria weights are loaded in the page. */
export async function fontsLoaded(page: Page): Promise<boolean[]> {
  return page.evaluate(async () => {
    const faces = await Promise.all(['400', '600', '900'].map((weight) => document.fonts.load(`${weight} 20px Alexandria`)));
    return faces.map((list) => list.length > 0 && list.every((face) => face.status === 'loaded'));
  });
}

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

/** A team's name field on the setup screen. */
export const nameField = (page: Page, team: Team) => page.getByLabel(`اسم الحي ${TEAM_COLOUR[team]}`);

/** The team names on the display. */
export const displayTeams = (page: Page) => page.getByTestId('display-teams');

/** Opens the referee window on a saved competition made of these events (as a ready-made scenario). */
export async function seedGame(page: Page, home: string, setup: Setup, events: GameEvent[]): Promise<void> {
  await page.goto(home);
  await page.evaluate((game) => localStorage.setItem('raqaa.game', JSON.stringify(game)), {
    schema: SCHEMA_VERSION,
    savedAt: Date.now(),
    setup,
    events,
  });
  await page.reload();
}

/** Opens the landing page and creates a new competition, from the button at its top. */
export async function createRoom(referee: Page, home: string): Promise<void> {
  await referee.goto(home);
  await referee.getByRole('button', { name: 'إنشاء غرفة' }).first().click();
  await expect(nameField(referee, 'coral')).toBeVisible();
}

/** Fills the whole setup: names, one mission each, and the sample questions. */
export async function fillSetup(referee: Page): Promise<void> {
  const names = { coral: 'الرواد', blue: 'النجوم', green: 'الصقور', gold: 'الفرسان' } as const;
  for (const [team, name] of Object.entries(names) as [Team, string][]) {
    await nameField(referee, team).fill(name);
    await referee.getByRole('button', { name: `مشاريع الحي ${TEAM_COLOUR[team]}` }).click();
    await referee.getByRole('button', { name: 'برج الرقعة' }).click();
    await referee.getByRole('button', { name: 'تم' }).click();
  }
  await referee.getByTestId('questions-file').setInputFiles(SAMPLE_QUESTIONS);
  await expect(referee.getByText('٣٠ سؤالاً')).toBeVisible();
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
  await createRoom(referee, home);
  await nameField(referee, 'coral').fill('الرواد');

  const display = await openDisplay(referee);
  await expect(displayTeams(display)).toContainText('الرواد');
  await nameField(referee, 'blue').fill('النجوم');
  await expect(displayTeams(display)).toContainText('النجوم');

  await display.reload();
  await expect(displayTeams(display)).toContainText('النجوم');

  await display.close();
  const fromLink = await referee.context().newPage();
  await fromLink.goto(own);
  await expect(displayTeams(fromLink)).toContainText('الرواد');

  // The new page took the front; a page in the background answers clicks slowly, as in a hidden browser tab.
  await referee.bringToFront();
  await referee.reload();
  await expect(nameField(referee, 'coral')).toHaveValue('الرواد');
  await nameField(referee, 'green').fill('الصقور');
  await expect(displayTeams(fromLink)).toContainText('الصقور');
}

/**
 * A display that opens while no referee window is open shows the competition as it was left. Here the
 * referee's own tab turns into the display, as happens in browsers that open the display in the same tab.
 * When the referee window opens again, the display follows it.
 */
export async function checkDisplayAlone(page: Page, home: string): Promise<void> {
  await createRoom(page, home);
  await nameField(page, 'coral').fill('الرواد');

  await page.evaluate(() => {
    location.hash = 'display';
  });
  await expect(page).toHaveTitle('شاشة العرض · رقعة');
  await expect(displayTeams(page)).toContainText('الرواد');

  const referee = await page.context().newPage();
  await referee.goto(home);
  await nameField(referee, 'blue').fill('النجوم');
  await expect(displayTeams(page)).toContainText('النجوم');
}
