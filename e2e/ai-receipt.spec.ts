/**
 * Receipt scan visual gate (PRD #145, ADR-0006, ADR-0004). The exported web
 * build with the deterministic fake (`?ai=fake`): the fake's scan returns
 * ¥1,280 / Food / today / "Lawson" without any camera.
 *
 * Geometry: the camera button lives inside the AI text line's row (so the form
 * does not grow), vertically centred on it, at its trailing edge, inside the
 * sheet; the pinned CTA stays on screen. Screenshots: the Entry sheet before
 * and after the scan, light and dark; every PNG was opened and inspected.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { OPEN_TIMEOUT, expectSheetOpen } from './app';

const JULY_3 = new Date('2026-07-03T10:00:00');
const TOL = 1.5;

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  return (await locator.boundingBox())!;
}

async function openEntry(page: Page, query = '?ai=fake') {
  await page.clock.install({ time: JULY_3 });
  await page.goto(`/${query}`);
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: OPEN_TIMEOUT });
  await page.getByLabel('Add entry', { exact: true }).click();
  await expectSheetOpen(page, 'entry-sheet');
}

async function scanAndCheck(page: Page, shot: (name: string) => Promise<void>) {
  const sheetEl = page.getByTestId('entry-sheet');
  const line = page.getByTestId('ai-entry-line');
  const button = page.getByRole('button', { name: 'Scan a receipt', exact: true });

  // Geometry: inside the line's row, centred on it, at its trailing edge.
  // The sheet may still be finishing its slide-up, so boxes read one after
  // another can come from different frames: retry until two reads agree.
  await expect(button).toBeVisible();
  let lineBox = await box(line);
  await expect(async () => {
    const a = await box(line);
    const b = await box(button);
    const a2 = await box(line);
    expect(Math.abs(a.y - a2.y), 'sheet settled').toBeLessThan(0.5);
    expect(Math.abs(b.y + b.height / 2 - (a.y + a.height / 2)), 'vertically centred').toBeLessThan(TOL);
    lineBox = a;
  }).toPass({ timeout: OPEN_TIMEOUT });
  const btn = await box(button);
  const sheetBox = await box(sheetEl);
  expect(btn.y).toBeGreaterThanOrEqual(lineBox.y - TOL);
  expect(btn.y + btn.height).toBeLessThanOrEqual(lineBox.y + lineBox.height + TOL);
  expect(btn.x + btn.width).toBeLessThanOrEqual(lineBox.x + lineBox.width + TOL);
  expect(lineBox.x + lineBox.width - (btn.x + btn.width), 'at the trailing edge').toBeLessThan(10);
  expect(btn.x).toBeGreaterThanOrEqual(sheetBox.x);
  expect(btn.x + btn.width).toBeLessThanOrEqual(sheetBox.x + sheetBox.width);
  expect(btn.y + btn.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  // The row kept its height (ADR-0004: the form does not grow).
  expect(Math.abs(lineBox.height - 44)).toBeLessThan(TOL);

  await shot('before');

  await button.click();
  await expect(page.getByTestId('ai-entry-filled')).toBeVisible({ timeout: 3_000 });
  await expect(sheetEl.getByText('¥1,280', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Note', { exact: true })).toHaveValue('Lawson');
  await expect(page.getByLabel('Date YYYY-MM-DD', { exact: true })).toHaveValue('2026-07-03');
  // Nothing saved: the sheet is still open with the CTA waiting.
  await expect(page.getByLabel('Add expense', { exact: true })).toBeEnabled();
  const footer = await box(page.getByTestId('entry-footer'));
  expect(footer.y + footer.height, 'CTA footer on screen').toBeLessThanOrEqual(page.viewportSize()!.height);
  // The line row is unchanged in place after the fill.
  const after = await box(line);
  expect(Math.abs(after.height - lineBox.height)).toBeLessThan(TOL);

  await shot('after');
}

test('unavailable: no receipt button without the on-device model', async ({ page }) => {
  await openEntry(page, '');
  await expect(page.getByTestId('ai-receipt-button')).toHaveCount(0);
});

test('receipt button sits in the AI line; a scan fills ¥1,280 without saving', async ({ page }) => {
  await openEntry(page);
  await scanAndCheck(page, (name) =>
    expect(page.getByTestId('entry-sheet')).toHaveScreenshot(`ai-receipt-${name}-light.png`, {
      maxDiffPixelRatio: 0.01,
    }),
  );
});

test.describe('dark appearance', () => {
  test.use({ colorScheme: 'dark' });

  test('receipt button and filled state in dark mode', async ({ page }) => {
    await openEntry(page);
    await scanAndCheck(page, (name) =>
      expect(page.getByTestId('entry-sheet')).toHaveScreenshot(`ai-receipt-${name}-dark.png`, {
        maxDiffPixelRatio: 0.01,
      }),
    );
  });
});
