/**
 * Calendar AI one-liners visual gate (PRD #145, ADR-0006). Drives the
 * exported web build with the deterministic fake (`?ai=fake`).
 *
 * Seeding: the browser clock starts at 20 Oct 2026 and the persisted ledger
 * (AsyncStorage → localStorage `kaji:state:v1`) is written before the app
 * boots, exactly as a returning user's saved blob would be. It holds:
 *   - ¥800 of Food every day from 1 Aug to 20 Oct (enough for a forecast and
 *     a same-weekday baseline),
 *   - a ¥6,000 Shopping spree on Wed 14 Oct (a notable day → day note),
 *   - Netflix ¥1,490 logged BY HAND on 1 Aug, 1 Sep and 1 Oct (a monthly
 *     payment with no repeat rule → repeat suggestion),
 *   - a real monthly rent rule on the 25th (a scheduled repeat the forecast adds).
 *
 * Geometry: every line on screen, clear of the floating tab bar, and in its
 * slot (forecast between the strip and the grid; day note under the day
 * label; repeat row above the day's entries). Screenshots: light + dark, each
 * PNG opened and inspected before being accepted.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { OPEN_TIMEOUT, expectSheetOpen, visibleDay } from './app';

const OCT_20 = new Date('2026-10-20T10:00:00');
const TOL = 1.5;

function seedState() {
  const entries: Record<string, unknown>[] = [];
  let i = 0;
  const add = (m: number, day: number, amount: number, category: string, note = '') =>
    entries.push({
      id: `seed-${i++}`,
      timestamp: `2026-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T03:00:00.000Z`,
      y: 2026,
      m,
      day,
      type: 'expense',
      amount,
      category,
      note,
      repeat: 'never',
    });
  for (let d = new Date(2026, 7, 1); d <= new Date(2026, 9, 20); d.setDate(d.getDate() + 1)) {
    add(d.getMonth(), d.getDate(), 800, 'Food', 'Lunch');
  }
  add(9, 14, 6000, 'Shopping', 'Shoes');
  for (const m of [7, 8, 9]) add(m, 1, 1490, 'Entertainment', 'Netflix');
  return {
    version: 1,
    state: {
      theme: 'system',
      expCats: ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment'],
      incCats: ['Salary', 'Bonus', 'Gift', 'Other'],
      entries,
      recurrenceRules: [
        {
          id: 'rent',
          timestamp: '2026-01-01T03:00:00.000Z',
          start: { y: 2026, m: 0, day: 25 },
          anchorDay: 25,
          type: 'expense',
          amount: 80000,
          category: 'Bills',
          note: 'Rent',
          repeat: 'monthly',
          weekendShift: 'off',
          exceptions: [],
        },
      ],
      calendarView: 'dots',
    },
  };
}

async function load(page: Page, { seed = true }: { seed?: boolean } = {}) {
  await page.clock.install({ time: OCT_20 });
  if (seed) {
    const blob = JSON.stringify(seedState());
    // Only on the very first document: a reload must see what the app saved.
    await page.addInitScript((value) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('kaji:state:v1', value);
        sessionStorage.setItem('seeded', '1');
      }
    }, blob);
  }
  await page.goto('/?ai=fake');
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: OPEN_TIMEOUT });
  await expect(page.getByLabel('Add entry', { exact: true })).toBeVisible();
  await expect(page.getByText('October').first()).toBeVisible();
}

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  return (await locator.boundingBox())!;
}

async function expectClearOfTabBar(page: Page, locator: Locator, what: string) {
  const b = await box(locator);
  const bar = await box(page.getByTestId('tab-bar'));
  expect(b.y, `${what} top on screen`).toBeGreaterThanOrEqual(0);
  expect(b.x, `${what} left on screen`).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width, `${what} right on screen`).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(b.y + b.height, `${what} clears the tab bar`).toBeLessThanOrEqual(bar.y + TOL);
}

async function selectDay14(page: Page) {
  await (await visibleDay(page, 14)).click();
  await expect(page.getByText('Wed, Oct 14', { exact: true })).toBeVisible();
}

/** Let fades and number rolls finish before a screenshot. */
async function settle(page: Page) {
  await expect(page.getByText('−¥6,800', { exact: true }).first()).toBeVisible();
  await page.waitForTimeout(600);
}

test('forecast, day note and repeat suggestion sit in their slots, clear of the tab bar', async ({ page }) => {
  await load(page);

  // Forecast: under the In/Out/Net strip, above the month grid.
  const forecast = page.getByTestId('ai-forecast');
  await expect(forecast).toContainText('At this pace the month ends near ¥');
  const f = await box(forecast);
  const outLabel = await box(page.getByText('Out', { exact: true }).first());
  const day1 = await box(await visibleDay(page, 1));
  expect(f.y, 'forecast below the strip').toBeGreaterThan(outLabel.y + outLabel.height);
  expect(f.y + f.height, 'forecast above the grid').toBeLessThan(day1.y);
  await expectClearOfTabBar(page, forecast, 'forecast');

  // Day note: only on the notable day, under its label.
  await expect(page.getByTestId('ai-day-note')).toHaveCount(0); // the 20th is ordinary
  await selectDay14(page);
  const note = page.getByTestId('ai-day-note');
  await expect(note).toHaveText('This day: ¥6,800.');
  const label = await box(page.getByText('Wed, Oct 14', { exact: true }));
  const n = await box(note);
  expect(n.y, 'note under the day label').toBeGreaterThanOrEqual(label.y + label.height - TOL);
  expect(Math.abs(n.x - label.x), 'note left-aligned with the label').toBeLessThanOrEqual(TOL);
  expect(Math.abs(f.x - label.x) <= 20, 'forecast and day label share the screen gutter').toBe(true);
  await expectClearOfTabBar(page, note, 'day note');

  // Repeat suggestion: one row above the day's entries.
  const row = page.getByTestId('ai-repeat');
  await expect(row).toContainText('Make Netflix a monthly payment?');
  const r = await box(row);
  const firstEntry = await box(page.getByText('Shoes', { exact: true }).first());
  expect(r.y, 'row below the day note').toBeGreaterThanOrEqual(n.y + n.height - TOL);
  expect(r.y + r.height, 'row above the entries').toBeLessThanOrEqual(firstEntry.y + TOL);
  expect(Math.abs(r.x - label.x), 'row aligned with the day panel').toBeLessThanOrEqual(TOL);
  await expectClearOfTabBar(page, row, 'repeat row');

  await settle(page);
  await expect(page).toHaveScreenshot('ai-calendar-lines.png', { maxDiffPixelRatio: 0.01 });
});

test('a past month shows no forecast and the grid does not move', async ({ page }) => {
  await load(page);
  await expect(page.getByTestId('ai-forecast')).toBeVisible();
  const before = await box(await visibleDay(page, 1));
  await page.getByLabel('Previous month', { exact: true }).click();
  await expect(page.getByText('September').first()).toBeVisible();
  await expect(page.getByTestId('ai-forecast')).toHaveCount(0);
  await expect(page.getByTestId('ai-repeat')).toHaveCount(0);
  await expect(async () => {
    const after = await box(await visibleDay(page, 1));
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(TOL);
  }).toPass({ timeout: 2_000 });
});

test('dismiss removes the suggestion for good', async ({ page }) => {
  await load(page);
  await expect(page.getByTestId('ai-repeat')).toBeVisible();
  await page.getByTestId('ai-repeat-dismiss').click();
  await expect(page.getByTestId('ai-repeat')).toHaveCount(0);
  // Persisted: it does not come back after a relaunch.
  await page.waitForTimeout(800); // the store's save debounce
  await page.reload();
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: OPEN_TIMEOUT });
  await expect(page.getByTestId('ai-forecast')).toBeVisible();
  await expect(page.getByTestId('ai-repeat')).toHaveCount(0);
});

test('accept opens the Entry sheet on the latest Netflix entry with repeat = monthly', async ({ page }) => {
  await load(page);
  await page.getByTestId('ai-repeat-accept').click();
  await expectSheetOpen(page, 'entry-sheet');
  const sheet = page.getByTestId('entry-sheet');
  await expect(sheet.getByText('¥1,490', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Note', { exact: true })).toHaveValue('Netflix');
  await expect(page.getByLabel('Date YYYY-MM-DD', { exact: true })).toHaveValue('2026-10-01');
  await expect(page.getByLabel('↻ Repeat: Every month', { exact: true })).toBeVisible();
});

test('unavailable: no Calendar AI lines without the on-device model', async ({ page }) => {
  await page.clock.install({ time: OCT_20 });
  const blob = JSON.stringify(seedState());
  await page.addInitScript((value) => localStorage.setItem('kaji:state:v1', value), blob);
  await page.goto('/');
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: OPEN_TIMEOUT });
  await selectDay14(page);
  for (const id of ['ai-forecast-slot', 'ai-forecast', 'ai-day-note', 'ai-repeat']) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }
});

test.describe('dark appearance', () => {
  test.use({ colorScheme: 'dark' });

  test('Calendar one-liners keep their contrast in dark mode', async ({ page }) => {
    await load(page);
    await selectDay14(page);
    await expect(page.getByTestId('ai-day-note')).toBeVisible();
    await expect(page.getByTestId('ai-repeat')).toContainText('Netflix');
    await settle(page);
    await expect(page).toHaveScreenshot('ai-calendar-lines-dark.png', { maxDiffPixelRatio: 0.01 });
  });
});
