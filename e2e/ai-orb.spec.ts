/**
 * Calendar AI orb visual gate (PRD #145). Drives the exported web build with
 * the deterministic fake (`?ai=fake`): the web orb is the static stand-in
 * (Skia only renders on iOS), so this pins placement, wiring and state, not
 * the Skia drawing.
 *
 * Geometry: the orb floats just above the ＋, centred on it (the ＋ is not the
 * bar's centre: the two tab labels differ in width, most in Japanese), fully
 * on screen, clear of the tab bar and below the calendar grid. Absent on
 * Summary and without the model.
 *
 * Screenshots: idle (light + dark), listening with the partial bubble, and the
 * month-scoped Ask. The fake's 80 ms level/partial timer would keep the
 * listening shot moving, so the page clock is paused for that one.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { OPEN_TIMEOUT, expectSheetOpen, visibleDay } from './app';

const JULY_3 = new Date('2026-07-03T10:00:00');
const TOL = 1.5;

async function load(page: Page, query = '?ai=fake') {
  await page.clock.install({ time: JULY_3 });
  await page.goto(`/${query}`);
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: OPEN_TIMEOUT });
  await expect(page.getByTestId('tab-bar')).toBeVisible();
}

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  return (await locator.boundingBox())!;
}

/** The tab bar's ＋ (EN 'Add entry', JA '入力を追加'). */
const fab = (page: Page) => page.getByTestId('tab-bar').getByLabel(/^(Add entry|入力を追加)$/);

async function expectPlacedAboveFab(page: Page, checkGrid = true) {
  const orb = await box(page.getByTestId('ai-orb'));
  const plus = await box(fab(page));
  const bar = await box(page.getByTestId('tab-bar'));
  const vw = page.viewportSize()!.width;

  expect(orb.x, 'orb left on screen').toBeGreaterThanOrEqual(0);
  expect(orb.x + orb.width, 'orb right on screen').toBeLessThanOrEqual(vw);
  expect(orb.width, 'orb hit area is a floating-button size').toBeGreaterThanOrEqual(56);
  expect(orb.width).toBeLessThanOrEqual(64);
  expect(
    Math.abs(orb.x + orb.width / 2 - (plus.x + plus.width / 2)),
    'orb is centred over the ＋',
  ).toBeLessThan(TOL);
  expect(orb.y + orb.height, 'orb bottom sits above the ＋ top').toBeLessThan(plus.y);
  expect(orb.y + orb.height, 'orb does not overlap the tab bar').toBeLessThanOrEqual(bar.y - 4);
  expect(bar.y - (orb.y + orb.height), 'orb floats just above the bar').toBeLessThan(24);

  // Nothing of the month grid sits under the orb (day labels are English-only here).
  if (!checkGrid) return;
  const lastWeek = await box(await visibleDay(page, 31));
  expect(lastWeek.y + lastWeek.height, 'grid ends above the orb').toBeLessThanOrEqual(orb.y);
}

test('without the on-device model there is no orb', async ({ page }) => {
  await load(page, '');
  await expect(page.getByLabel('Add entry', { exact: true })).toBeVisible();
  await expect(page.getByTestId('ai-orb')).toHaveCount(0);
});

test('orb floats centred just above the ＋, clear of the grid and the bar; absent on Summary', async ({ page }) => {
  await load(page);
  await expect(page.getByTestId('ai-orb')).toHaveAttribute('aria-valuetext', 'idle');
  await expect(page.getByTestId('ai-orb')).toHaveAttribute('aria-label', 'Suito AI');
  await expectPlacedAboveFab(page);
  await expect(page).toHaveScreenshot('ai-orb-calendar-light.png', { maxDiffPixelRatio: 0.01 });

  await page.getByRole('tab', { name: 'Summary', exact: true }).click();
  await expect(page.getByText('Net this month').first()).toBeVisible();
  await expect(page.getByTestId('ai-orb')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
  await expect(page.getByTestId('ai-orb')).toBeVisible();
  await expect(async () => expectPlacedAboveFab(page)).toPass({ timeout: 3_000 });
});

test.describe('japanese labels', () => {
  // カレンダー vs 集計: the widest label difference, so the ＋ is furthest off centre.
  test.use({ locale: 'ja-JP' });
  test('orb still centres on the off-centre ＋', async ({ page }) => {
    await load(page);
    await expectPlacedAboveFab(page, false);
  });
});

test.describe('dark appearance', () => {
  test.use({ colorScheme: 'dark' });
  test('idle orb keeps its contrast in dark mode', async ({ page }) => {
    await load(page);
    await expectPlacedAboveFab(page);
    await expect(page).toHaveScreenshot('ai-orb-calendar-dark.png', { maxDiffPixelRatio: 0.01 });
  });
});

test('tap opens Ask scoped to the visible month', async ({ page }) => {
  await load(page);
  await page.getByTestId('ai-orb').click();
  await expectSheetOpen(page, 'ask-sheet');
  const ask = page.getByTestId('ask-sheet');
  await expect(ask.getByTestId('ask-scope')).toHaveAttribute('aria-label', 'July 2026');
  await expect(ask.getByTestId('ask-scope')).toContainText('July 2026');
  await expect(ask).toHaveScreenshot('ai-orb-ask-scoped.png', { maxDiffPixelRatio: 0.01 });

  // The scope rides along with the question.
  await ask.getByLabel('How much did I spend this month?', { exact: true }).click();
  await expect(ask.getByTestId('ask-answer')).toContainText('steady pace', { timeout: 3_000 });
});

test('hold → partial bubble → release → Entry sheet filled with ¥850', async ({ page }) => {
  await load(page);
  const orb = page.getByTestId('ai-orb');
  const c = await box(orb);
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();

  await expect(orb).toHaveAttribute('aria-valuetext', 'listen', { timeout: 2_000 });
  const bubble = page.getByTestId('ai-orb-bubble');
  await expect(bubble).toHaveText('lunch 850 yesterday', { timeout: 2_000 });

  // Bubble geometry: above the orb, centred on it, on screen.
  const b = await box(bubble);
  const o = await box(orb);
  expect(b.y + b.height, 'bubble sits above the orb').toBeLessThanOrEqual(o.y + TOL);
  expect(Math.abs(b.x + b.width / 2 - (o.x + o.width / 2)), 'bubble centred on the orb').toBeLessThan(TOL);
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize()!.width);

  // Freeze the fake's 80 ms level timer for a stable shot, then let time run again.
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 50);
  await expect(page).toHaveScreenshot('ai-orb-listening.png', { maxDiffPixelRatio: 0.01 });
  await page.clock.resume();
  await page.waitForTimeout(600);

  await page.mouse.up();
  await expectSheetOpen(page, 'entry-sheet');
  const entry = page.getByTestId('entry-sheet');
  await expect(entry.getByText('¥850').first()).toBeVisible({ timeout: 2_000 });
  await expect(orb).toHaveAttribute('aria-valuetext', 'idle');
  await expect(bubble).toHaveCount(0);
});

test('a slip (short hold) opens nothing and says so', async ({ page }) => {
  await load(page);
  const orb = page.getByTestId('ai-orb');
  const c = await box(orb);
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await expect(orb).toHaveAttribute('aria-valuetext', 'listen', { timeout: 2_000 });
  await page.mouse.up();
  await expect(page.getByTestId('ai-orb-bubble')).toHaveText('Hold a little longer while you speak');
  await expect(page.getByTestId('entry-sheet')).toHaveCount(0);
  await expect(page.getByTestId('ask-sheet')).toHaveCount(0);
});
