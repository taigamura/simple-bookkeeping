import { expect, test } from '@playwright/test';

import { center, coldLoad, expectSheetGone, expectSheetOpen, sheet, tapAt } from './app';

test('swiping an entry reveals Delete without opening the editor', async ({ page }) => {
  const { fab } = await coldLoad(page);
  await tapAt(page, fab);
  await expectSheetOpen(page, 'entry-sheet');

  const entrySheet = sheet(page, 'entry-sheet');
  await tapAt(page, await center(entrySheet.getByLabel('1', { exact: true })));
  await tapAt(page, await center(entrySheet.getByLabel('Add expense', { exact: true })));
  await expectSheetGone(page, 'entry-sheet');

  const row = page.getByLabel('Edit Food', { exact: true });
  await expect(row).toBeVisible();
  const box = (await row.boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 12, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, y, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByLabel('Delete Food', { exact: true })).toBeVisible();
  await expect(sheet(page, 'entry-sheet')).toBeHidden();
});
