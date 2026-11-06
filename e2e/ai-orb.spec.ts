/**
 * AI orb accessory visual gate (PRD #145). Drives the exported web build with
 * the deterministic fake (`?ai=fake`): the web orb is the static stand-in
 * (Skia only renders on iOS), and the strip is the web/Android card, not
 * UIKit's tab-bar accessory (iOS 26 only; verify on device). So this pins
 * placement, wiring and state, not the Skia drawing or the native glass.
 *
 * Geometry: the strip (sphere + label + hint) docks just above the tab bar,
 * centred on it, fully on screen, below the calendar grid. Present on both
 * tabs; absent without the model. Status text replaces the label in place.
 *
 * Screenshots: idle (light + dark), listening with the partial bubble, and the
 * month-scoped Ask. The fake's 80 ms level/partial timer would keep the
 * listening shot moving, so the page clock is paused for that one.
 *
 * Motion: the orb floats (turns, bobs, breathes) like voice-memo's. Page shots
 * mask the moving sphere; the sphere itself is pinned under reduced motion,
 * where it holds still. A separate test proves it moves when motion is on.
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

/** The animated sphere is masked out of page shots; its look is pinned under reduced motion. */
const orbMask = (page: Page) => ({
  mask: [page.getByTestId('ai-orb-sphere').first()],
  maxDiffPixelRatio: 0.01,
});
/** The visible strip (both tab layers are briefly mounted during a swap). */
const strip = (page: Page) => page.locator('[data-testid="ai-orb"]:visible').first();

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  return (await locator.boundingBox())!;
}

async function expectDockedAboveBar(page: Page, checkGrid = true) {
  const orb = await box(strip(page));
  const bar = await box(page.getByTestId('tab-bar'));
  const vw = page.viewportSize()!.width;

  expect(orb.x, 'strip left on screen').toBeGreaterThanOrEqual(0);
  expect(orb.x + orb.width, 'strip right on screen').toBeLessThanOrEqual(vw);
  expect(orb.height, 'strip is a comfortable tap target').toBeGreaterThanOrEqual(44);
  expect(orb.width, 'strip spans most of the bar width').toBeGreaterThanOrEqual(bar.width * 0.9);
  expect(
    Math.abs(orb.x + orb.width / 2 - (bar.x + bar.width / 2)),
    'strip is centred on the bar',
  ).toBeLessThan(TOL);
  expect(orb.y + orb.height, 'strip does not overlap the tab bar').toBeLessThanOrEqual(bar.y - 4);
  expect(bar.y - (orb.y + orb.height), 'strip docks just above the bar').toBeLessThanOrEqual(20);

  // The sphere sits inside the strip, vertically centred.
  const sphere = await box(page.locator('[data-testid="ai-orb-sphere"]:visible').first());
  expect(sphere.x).toBeGreaterThanOrEqual(orb.x);
  expect(Math.abs(sphere.y + sphere.height / 2 - (orb.y + orb.height / 2)), 'sphere centred').toBeLessThan(TOL + 1);

  // Nothing of the month grid sits under the strip (day labels are English-only here).
  if (!checkGrid) return;
  const lastWeek = await box(await visibleDay(page, 31));
  expect(lastWeek.y + lastWeek.height, 'grid ends above the strip').toBeLessThanOrEqual(orb.y);
}

test('without the on-device model there is no orb', async ({ page }) => {
  await load(page, '');
  await expect(page.getByLabel('Add entry', { exact: true })).toBeVisible();
  await expect(page.getByTestId('ai-orb')).toHaveCount(0);
});

test('orb strip docks just above the tab bar, clear of the grid; also on Summary', async ({ page }) => {
  await load(page);
  await expect(page.getByTestId('ai-orb')).toHaveAttribute('aria-valuetext', 'idle');
  await expect(page.getByTestId('ai-orb')).toHaveAttribute('aria-label', 'Suito AI');
  await expect(page.getByTestId('ai-orb')).toContainText('Tap to ask · hold to say an entry');
  await expectDockedAboveBar(page);
  await expect(page).toHaveScreenshot('ai-orb-calendar-light.png', orbMask(page));

  await page.getByRole('tab', { name: 'Summary', exact: true }).click();
  await expect(page.getByText('Net this month').first()).toBeVisible();
  await expect(async () => expectDockedAboveBar(page, false)).toPass({ timeout: 3_000 });
  await expect(page).toHaveScreenshot('ai-orb-summary-light.png', orbMask(page));

  await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
  await expect(async () => expectDockedAboveBar(page)).toPass({ timeout: 3_000 });
});

test('idle orb floats like voice-memo: it keeps moving while you look at it', async ({ page }) => {
  await load(page);
  const orb = page.getByTestId('ai-orb-sphere');
  await expect(page.getByTestId('ai-orb')).toHaveAttribute('aria-valuetext', 'idle');
  const shots: Buffer[] = [];
  for (let i = 0; i < 3; i++) {
    shots.push(await orb.screenshot());
    await page.clock.runFor(700);
  }
  expect(shots[1].equals(shots[0]), 'sphere moved after 0.7 s').toBe(false);
  expect(shots[2].equals(shots[1]), 'and keeps moving').toBe(false);
  // No disc behind it: it hovers over a ground shadow.
  await expect(page.getByTestId('ai-orb-disc')).toHaveCount(0);
  await expect(page.getByTestId('ai-orb-sphere-shadow')).toBeVisible();
});

test.describe('reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test('the orb holds still, and its look is pinned', async ({ page }) => {
    await load(page);
    const orb = page.getByTestId('ai-orb-sphere');
    const before = await orb.screenshot();
    await page.clock.runFor(1500);
    expect((await orb.screenshot()).equals(before), 'no motion under reduced motion').toBe(true);
    await expect(orb).toHaveScreenshot('ai-orb-still-light.png', { maxDiffPixelRatio: 0.01 });
  });

  test.describe('dark', () => {
    test.use({ colorScheme: 'dark' });
    test('still orb keeps its contrast in dark mode', async ({ page }) => {
      await load(page);
      await expect(page.getByTestId('ai-orb-sphere')).toHaveScreenshot('ai-orb-still-dark.png', { maxDiffPixelRatio: 0.01 });
    });
  });
});

test.describe('japanese labels', () => {
  test.use({ locale: 'ja-JP' });
  test('the strip and its Japanese hint fit above the bar', async ({ page }) => {
    await load(page);
    await expect(page.getByTestId('ai-orb')).toContainText('タップで質問・長押しで声で入力');
    await expectDockedAboveBar(page, false);
    await expect(page).toHaveScreenshot('ai-orb-calendar-ja.png', orbMask(page));
  });
});

test.describe('dark appearance', () => {
  test.use({ colorScheme: 'dark' });
  test('idle orb keeps its contrast in dark mode', async ({ page }) => {
    await load(page);
    await expectDockedAboveBar(page);
    await expect(page).toHaveScreenshot('ai-orb-calendar-dark.png', orbMask(page));
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

test('hold → partial bubble → release → saved straight away; tap edits it', async ({ page }) => {
  await load(page);
  const orb = page.getByTestId('ai-orb');
  const c = await box(orb);
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();

  await expect(orb).toHaveAttribute('aria-valuetext', 'listen', { timeout: 2_000 });
  const bubble = page.getByTestId('ai-orb-bubble');
  await expect(bubble).toHaveText('lunch 850 yesterday', { timeout: 2_000 });

  // The transcript replaces the label inside the strip; the strip doesn't move.
  const b = await box(bubble);
  const o = await box(orb);
  expect(b.y, 'transcript inside the strip').toBeGreaterThanOrEqual(o.y);
  expect(b.y + b.height).toBeLessThanOrEqual(o.y + o.height);
  expect(b.x + b.width).toBeLessThanOrEqual(o.x + o.width);
  await expectDockedAboveBar(page);

  // Freeze the fake's 80 ms level timer for a stable shot, then let time run again.
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 50);
  await expect(page).toHaveScreenshot('ai-orb-listening.png', orbMask(page));
  await page.clock.resume();
  await page.waitForTimeout(600);

  await page.mouse.up();
  // No Entry sheet: the entry is saved and the strip says so.
  await expect(bubble).toHaveText(/^Added ¥850 · /, { timeout: 3_000 });
  await expect(orb).toContainText('Tap to edit');
  await expect(page.getByTestId('entry-sheet')).toHaveCount(0);
  await expect(orb).toHaveAttribute('aria-valuetext', 'idle');
  // It landed on yesterday (July 2), which the Calendar now selects.
  await expect(page.getByText('lunch', { exact: true }).first()).toBeVisible();
  await expectDockedAboveBar(page);
  // Let the save wave and the totals roll finish (well inside the 5 s window).
  await expect(page.getByText('¥850', { exact: true }).first()).toBeVisible({ timeout: 3_000 });
  await page.waitForTimeout(1500);
  await expect(page).toHaveScreenshot('ai-orb-saved.png', orbMask(page));

  // Tap while it shows: edit that entry.
  await orb.click();
  await expectSheetOpen(page, 'entry-sheet');
  const entry = page.getByTestId('entry-sheet');
  await expect(entry.getByText('¥850').first()).toBeVisible();
  await expect(entry.getByLabel('Delete entry', { exact: true })).toBeVisible();
});

test('the "Added" line clears after a few seconds and tap asks again', async ({ page }) => {
  await load(page);
  const orb = page.getByTestId('ai-orb');
  const c = await box(orb);
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  await expect(page.getByTestId('ai-orb-bubble')).toHaveText('lunch 850 yesterday', { timeout: 2_000 });
  await page.waitForTimeout(600);
  await page.mouse.up();
  await expect(page.getByTestId('ai-orb-bubble')).toHaveText(/^Added/, { timeout: 3_000 });
  await page.clock.runFor(5_500);
  await expect(page.getByTestId('ai-orb-bubble')).toHaveCount(0);
  await expect(orb).toContainText('Tap to ask');
  await orb.click();
  await expectSheetOpen(page, 'ask-sheet');
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
