/**
 * Bounded craft-review probes for #120. These use the shipped web export at
 * both phone extremes instead of a component-only approximation, while the
 * native VoiceOver/Dynamic Type walkthrough remains in the release checklist.
 */
import { expect, test } from '@playwright/test';

import { center, coldLoad, expectSheetOpen, sheet, tapAt } from './app';

test.describe('small iPhone, light appearance, reduced motion', () => {
  test.use({
    viewport: { width: 375, height: 667 },
    colorScheme: 'light',
    locale: 'en-US',
  });

  test('keeps the Import data action fully reachable and touch-sized', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { gear } = await coldLoad(page);
    await page.mouse.click(gear.x, gear.y);
    const settings = sheet(page, 'settings-sheet');
    await expect(settings).toBeVisible();

    const importData = settings.getByLabel('Import data', { exact: true });
    await importData.scrollIntoViewIfNeeded();
    const box = (await importData.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  });
});

test.describe('large iPhone, dark appearance, Japanese, full motion', () => {
  test.use({
    viewport: { width: 430, height: 932 },
    colorScheme: 'dark',
    locale: 'ja-JP',
  });

  test('renders the localized import action in the Settings reading order', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await expect(page.getByTestId('loading-screen')).toBeHidden();
    await page.getByLabel('設定', { exact: true }).click();
    const settings = sheet(page, 'settings-sheet');
    await expect(settings).toBeVisible();

    const importData = settings.getByLabel('データを読み込む', { exact: true });
    await importData.scrollIntoViewIfNeeded();
    await expect(importData).toBeVisible();
    expect(await importData.getAttribute('role')).toBe('button');
  });
});

test.describe('save-wave shape', () => {
  test('draws a circular, app-canvas wave after a successful save', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const { fab } = await coldLoad(page);
    await tapAt(page, fab);
    const entry = sheet(page, 'entry-sheet');
    await expectSheetOpen(page, 'entry-sheet');
    await tapAt(page, await center(entry.getByLabel('1', { exact: true })));
    await tapAt(page, await center(entry.getByLabel('Add expense', { exact: true })));

    const host = page.getByTestId('save-wave-overlay');
    const circle = host.locator('> div');
    await expect(circle).toBeVisible({ timeout: 1_000 });
    const shape = await circle.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        width: Number.parseFloat(style.width),
        height: Number.parseFloat(style.height),
        radius: Number.parseFloat(style.borderRadius),
      };
    });
    expect(shape.width).toBeGreaterThan(0);
    expect(shape.height).toBeCloseTo(shape.width, 1);
    expect(shape.radius).toBeCloseTo(shape.width / 2, 1);
  });
});
