// The setup, from the landing page to «ابدأ», on the website.
import { readFileSync } from 'node:fs';
import { read, utils } from 'xlsx';
import { createRoom, displayTeams, expect, fillSetup, nameField, openDisplay, test } from './fixtures.ts';

test.describe('setup', () => {
  test('fill it in, start, and reload', async ({ page }) => {
    await createRoom(page, '/');
    const start = page.getByRole('button', { name: 'ابدأ' });
    await expect(start).toBeDisabled();
    // A team's tile shows its colour and its symbol; the colour's name is for screen readers only.
    await expect(page.locator('.setup-team').first()).not.toContainText('المرجاني');

    await fillSetup(page);
    await page.getByRole('group', { name: 'عدد الأيام' }).getByRole('button', { name: 'ناقص' }).click();
    await page.getByRole('radio', { name: '٧×٧' }).click();
    await expect(start).toBeEnabled();

    // Everything is saved as it is typed.
    await page.reload();
    await expect(nameField(page, 'gold')).toHaveValue('الفرسان');
    await expect(page.getByText('questions-sample.csv')).toBeVisible();
    await expect(page.getByRole('group', { name: 'عدد الأيام' })).toContainText('١١');
    await expect(page.getByRole('radio', { name: '٧×٧' })).toHaveAttribute('aria-checked', 'true');

    const display = await openDisplay(page);
    await start.click();
    await expect(page.getByRole('heading', { name: 'اليوم ١ من ١١' })).toBeVisible();
    await expect(displayTeams(display)).toContainText('الفرسان');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'اليوم ١ من ١١' })).toBeVisible();
    await expect(page.locator('.plot')).toHaveCount(49); // the 7×7 map
  });

  test('Enter moves on to the next name', async ({ page }) => {
    await createRoom(page, '/');
    await nameField(page, 'coral').fill('الرواد');
    await nameField(page, 'coral').press('Enter');
    await expect(nameField(page, 'blue')).toBeFocused();
    await page.keyboard.type('النجوم');
    await page.keyboard.press('Enter');
    await expect(nameField(page, 'green')).toBeFocused();
    await expect(nameField(page, 'blue')).toHaveValue('النجوم');
    await nameField(page, 'gold').press('Enter'); // the last name closes the field
    await expect(nameField(page, 'gold')).not.toBeFocused();
  });

  test('missions are hidden once chosen, up to three per team', async ({ page }) => {
    await createRoom(page, '/');
    await page.getByRole('button', { name: 'مشاريع الحي المرجاني' }).click();
    // Each level says what success adds to the population, and what failure takes away.
    const rewards = page.locator('.mission-level').first().locator('.mission-reward');
    await expect(rewards).toHaveText(['نجاح +٤٠٠', 'فشل −٢٠٠']);
    await expect(page.locator('.mission-level').last().locator('.mission-reward')).toHaveText(['نجاح +١٬٢٠٠', 'فشل −٦٠٠']);
    for (const name of ['برج الرقعة', 'قلب المدينة', 'مربع سكني']) await page.getByRole('button', { name }).click();
    await expect(page.getByRole('button', { name: 'جار الجميع' })).toBeDisabled();
    await page.getByRole('button', { name: 'تم' }).click();
    await expect(page.getByText('٣ مشاريع')).toBeVisible();
    await expect(page.getByText('قلب المدينة')).toHaveCount(0);
    await page.getByRole('button', { name: 'إظهار مشاريع الحي المرجاني' }).click();
    await expect(page.getByText('قلب المدينة')).toBeVisible();
  });

  test('a wrong questions file shows what is wrong, in Arabic', async ({ page }) => {
    await createRoom(page, '/');
    await page.getByTestId('questions-file').setInputFiles({
      name: 'أسئلة.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('سؤال,جواب\nأ,ب\n'),
    });
    await expect(page.getByRole('alert')).toHaveText('يجب أن يكون في الصف الأول عمودا «السؤال» و«الإجابة».');
  });

  test('the empty template downloads with the two columns', async ({ page }) => {
    await createRoom(page, '/');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'تنزيل القالب' }).click()]);
    expect(download.suggestedFilename()).toBe('قالب أسئلة رقعة.xlsx');
    const book = read(readFileSync(await download.path()));
    const rows = utils.sheet_to_json<string[]>(book.Sheets[book.SheetNames[0]!]!, { header: 1 });
    expect(rows[0]).toEqual(['السؤال', 'الإجابة']);
  });
});
