/**
 * Suito AI visual gate (ADR-0006). Drives the exported web build with the
 * deterministic fake (`?ai=fake`, picked in App.tsx) and, for the unavailable
 * state, without it.
 *
 * Seeding: no e2e-only hooks. The letter needs a past month with entries, so
 * each scenario starts the browser clock at 3 July 2026 (Playwright's
 * `clock.install`; time then flows normally), then
 * uses the app's own Settings > "Load sample data" (June 2026). July is then
 * "this month" and June is "last month".
 *
 * Geometry: every AI surface must be on screen, clear of the floating tab bar,
 * and aligned with the surface it belongs to. Screenshots: one baseline per
 * state; each PNG was opened and inspected before being accepted.
 *
 * NOTE: while `ai/facts.ts` / `ai/cite.ts` are stubs, the letter and nudge
 * cite no facts (the fake falls back to token-free lines). Once the domain
 * slice lands, the letter/nudge text gains real figures and these baselines
 * must be regenerated deliberately (and inspected again).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { OPEN_TIMEOUT, expectSheetOpen } from './app';

const JULY_3 = new Date('2026-07-03T10:00:00');
const TOL = 1.5;

async function load(page: Page, query = '?ai=fake') {
  // `install` (not `setFixedTime`): time starts at JULY_3 and then flows, so
  // requestAnimationFrame timestamps advance and number rolls can finish.
  await page.clock.install({ time: JULY_3 });
  // Load sample data / restore confirm through window.confirm on web.
  page.on('dialog', (dialog) => void dialog.accept());
  await page.goto(`/${query}`);
  await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: OPEN_TIMEOUT });
  await expect(page.getByLabel('Add entry', { exact: true })).toBeVisible();
}

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  return (await locator.boundingBox())!;
}

/** On screen and entirely above the floating tab bar. */
async function expectClearOfTabBar(page: Page, locator: Locator, what: string) {
  const b = await box(locator);
  const bar = await box(page.getByTestId('tab-bar'));
  expect(b.y, `${what} top on screen`).toBeGreaterThanOrEqual(0);
  expect(b.x, `${what} left on screen`).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width, `${what} right on screen`).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(b.y + b.height, `${what} clears the tab bar`).toBeLessThanOrEqual(bar.y + TOL);
}

async function loadSampleData(page: Page) {
  await page.getByLabel('Settings', { exact: true }).first().click();
  await expectSheetOpen(page, 'settings-sheet');
  await page.getByLabel('Load sample data', { exact: true }).click();
  await expect(page.getByTestId('settings-sheet')).toBeHidden({ timeout: OPEN_TIMEOUT });
}

/** Summary tab; a second tap on it jumps the cursor back to "now" (July). */
async function openSummaryNow(page: Page) {
  const tab = page.getByRole('tab', { name: 'Summary', exact: true });
  await tab.click();
  await expect(page.getByText('Net this month').first()).toBeVisible();
  await tab.click();
  await expect(page.getByText('July 2026').first()).toBeVisible();
  // July is empty: wait for the hero's number roll from June to land, so a
  // screenshot never catches it mid-roll.
  await expect(page.getByText('+¥0', { exact: true }).first()).toBeVisible();
}

test('unavailable: no AI surface anywhere without the on-device model', async ({ page }) => {
  await load(page, '');
  await page.getByLabel('Add entry', { exact: true }).click();
  await expectSheetOpen(page, 'entry-sheet');
  await expect(page.getByTestId('entry-sheet')).toBeVisible();
  await expect(page.getByTestId('ai-entry-line')).toHaveCount(0);
  await page.getByLabel('Close', { exact: true }).first().click();
  await expect(page.getByTestId('entry-sheet')).toBeHidden({ timeout: OPEN_TIMEOUT });

  await loadSampleData(page);
  await openSummaryNow(page);
  await expect(page.getByTestId('ask-pill')).toHaveCount(0);
  await expect(page.getByTestId('ai-letter')).toHaveCount(0);
  await expect(page.getByTestId('ai-nudge')).toHaveCount(0);

  await page.getByLabel('Settings', { exact: true }).first().click();
  await expectSheetOpen(page, 'settings-sheet');
  await expect(page.getByTestId('settings-ai')).toHaveCount(0);
  await expect(page.getByText('Recaps and nudges')).toHaveCount(0);
  await page.getByLabel('Close', { exact: true }).first().click();

  await expect(page).toHaveScreenshot('ai-unavailable-summary.png', { maxDiffPixelRatio: 0.01 });
});

test('entry text line fills amount, category, date and note; the sheet still fits', async ({ page }) => {
  await load(page);
  await page.getByLabel('Add entry', { exact: true }).click();
  await expectSheetOpen(page, 'entry-sheet');
  const line = page.getByTestId('ai-entry-line');
  const input = page.getByLabel('Describe the entry in words', { exact: true });
  await input.fill('lunch 850 yesterday');

  await expect(page.getByTestId('ai-entry-filled')).toBeVisible({ timeout: 3_000 });
  const sheetEl = page.getByTestId('entry-sheet');
  await expect(sheetEl.getByText('¥850', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Note', { exact: true })).toHaveValue('lunch');
  await expect(page.getByLabel('Date YYYY-MM-DD', { exact: true })).toHaveValue('2026-07-02');
  // Nothing saved: the sheet is still open, the CTA is enabled and waiting.
  await expect(page.getByLabel('Add expense', { exact: true })).toBeEnabled();

  // Geometry: the line sits between the type toggle and the amount, full form
  // width, and the pinned CTA still fits on screen (ADR-0004).
  const sheetBox = await box(sheetEl);
  const lineBox = await box(line);
  const amountBox = await box(sheetEl.getByText('¥850', { exact: true }));
  const toggleBox = await box(page.getByTestId('entry-sheet').getByRole('radio', { name: 'Expense' }));
  expect(lineBox.y).toBeGreaterThan(toggleBox.y + toggleBox.height - TOL);
  expect(lineBox.y + lineBox.height).toBeLessThan(amountBox.y + TOL);
  expect(lineBox.x).toBeGreaterThanOrEqual(sheetBox.x - TOL);
  expect(lineBox.x + lineBox.width).toBeLessThanOrEqual(sheetBox.x + sheetBox.width + TOL);
  const footer = await box(page.getByTestId('entry-footer'));
  expect(footer.y + footer.height, 'CTA footer on screen').toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );

  await expect(sheetEl).toHaveScreenshot('ai-entry-line-filled.png', { maxDiffPixelRatio: 0.01 });
});

test('letter card and nudge row under the Summary hero', async ({ page }) => {
  await load(page);
  await loadSampleData(page);
  await openSummaryNow(page);

  const hero = page.getByTestId('ask-pill');
  const letter = page.getByTestId('ai-letter');
  const nudge = page.getByTestId('ai-nudge');
  await expect(letter).toBeVisible({ timeout: 5_000 });
  await expect(nudge).toBeVisible({ timeout: 5_000 });
  await expect(letter.getByText('Your June recap')).toBeVisible();

  // Pill: inside the hero's top row, right-aligned with the hero padding.
  const pill = await box(hero);
  const letterBox = await box(letter);
  const nudgeBox = await box(nudge);
  expect(pill.y + pill.height).toBeLessThan(letterBox.y);
  // Letter and nudge share the hero's column: same left edge and width.
  expect(Math.abs(letterBox.x - nudgeBox.x)).toBeLessThan(TOL);
  expect(Math.abs(letterBox.width - nudgeBox.width)).toBeLessThan(TOL);
  expect(nudgeBox.y).toBeGreaterThanOrEqual(letterBox.y + letterBox.height - TOL);
  await expectClearOfTabBar(page, letter, 'letter card');
  await expectClearOfTabBar(page, nudge, 'nudge row');

  await expect(page).toHaveScreenshot('ai-summary-letter-nudge-light.png', { maxDiffPixelRatio: 0.01 });

  // Dismiss both on July; June's own Summary then offers the letter again.
  await page.getByLabel('Hide recap', { exact: true }).click();
  await page.getByLabel('Hide observation', { exact: true }).click();
  await expect(letter).toHaveCount(0);
  await expect(nudge).toHaveCount(0);
  // Swipe-free way back to June: the Calendar tab's cursor still tracks the
  // Summary cursor, so step back with the Calendar chevron and return.
  await page.getByRole('tab', { name: 'Calendar', exact: true }).click();
  await page.getByLabel('Previous month', { exact: true }).first().click();
  await page.getByRole('tab', { name: 'Summary', exact: true }).click();
  await expect(page.getByText('June 2026').first()).toBeVisible();
  const reopen = page.getByTestId('ai-letter-reopen');
  await expect(reopen).toBeVisible();
  await expectClearOfTabBar(page, reopen, 'reopen row');
  await expect(reopen).toHaveScreenshot('ai-letter-reopen-row.png', { maxDiffPixelRatio: 0.01 });
  await reopen.click();
  await expect(page.getByTestId('ai-letter')).toBeVisible();
});

test.describe('dark appearance', () => {
  // Booted dark (the app follows the OS by default) rather than flipped
  // mid-test, so the shot is the settled palette, not a fade-through frame.
  test.use({ colorScheme: 'dark' });

  test('letter card and nudge row keep their contrast in dark mode', async ({ page }) => {
    await load(page);
    await loadSampleData(page);
    await openSummaryNow(page);
    await expect(page.getByTestId('ai-letter')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('ai-nudge')).toBeVisible({ timeout: 5_000 });
    await expectClearOfTabBar(page, page.getByTestId('ai-nudge'), 'nudge row');
    await expect(page).toHaveScreenshot('ai-summary-letter-nudge-dark.png', { maxDiffPixelRatio: 0.01 });
  });
});

test('Ask sheet streams an answer, then previews the hand-off prompt', async ({ page }) => {
  await load(page);
  await loadSampleData(page);
  await openSummaryNow(page);
  await page.getByTestId('ask-pill').click();
  await expectSheetOpen(page, 'ask-sheet');
  const ask = page.getByTestId('ask-sheet');

  // Record every text the answer passes through, to prove it streamed.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __answers: string[] }).__answers = seen;
    new MutationObserver(() => {
      const el = document.querySelector('[data-testid="ask-answer"]');
      const t = el?.textContent ?? '';
      if (t && seen[seen.length - 1] !== t) seen.push(t);
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await ask.getByLabel('How much did I spend this month?', { exact: true }).click();
  const full = 'Looking at this month, your spending is moving at its usual, steady pace.';
  await expect(ask.getByText(full)).toBeVisible({ timeout: 3_000 });
  const answers = await page.evaluate(() => (window as unknown as { __answers: string[] }).__answers);
  expect(answers.length, `answer streamed in steps: ${JSON.stringify(answers)}`).toBeGreaterThanOrEqual(3);

  // Geometry: the input row sits inside the sheet, on screen, below the answer.
  const sheetBox = await box(ask);
  const inputBox = await box(ask.getByLabel('Your question', { exact: true }));
  const answerBox = await box(ask.getByTestId('ask-answer'));
  expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(sheetBox.y + sheetBox.height + TOL);
  expect(inputBox.y).toBeGreaterThan(answerBox.y + answerBox.height - TOL);
  await expect(ask).toHaveScreenshot('ai-ask-answer.png', { maxDiffPixelRatio: 0.01 });

  // A planning question: the model flags it, the hand-off is promoted.
  await ask.getByLabel('Your question', { exact: true }).fill('Any advice for saving more?');
  await ask.getByLabel('Send question', { exact: true }).click();
  await expect(ask.getByTestId('ask-stronger')).toBeVisible({ timeout: 3_000 });
  await ask.getByTestId('ask-stronger').getByLabel('Ask another AI', { exact: true }).click();
  const preview = page.getByTestId('ask-handoff-prompt');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('Any advice for saving more?');
  const shareBox = await box(page.getByLabel('Share', { exact: true }));
  expect(shareBox.y + shareBox.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await expect(page.getByTestId('ask-sheet')).toHaveScreenshot('ai-ask-handoff-preview.png', {
    maxDiffPixelRatio: 0.01,
  });
});

test('Settings AI section: both switches with their explanations', async ({ page }) => {
  await load(page);
  await page.getByLabel('Settings', { exact: true }).first().click();
  await expectSheetOpen(page, 'settings-sheet');
  const section = page.getByTestId('settings-ai');
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByText('Recaps and nudges')).toBeVisible();
  await expect(section.getByText('Siri & Search')).toBeVisible();
  const s = await box(section);
  const sheetBox = await box(page.getByTestId('settings-sheet'));
  expect(s.y).toBeGreaterThanOrEqual(sheetBox.y);
  expect(s.y + s.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(s.x).toBeGreaterThanOrEqual(sheetBox.x);
  expect(s.x + s.width).toBeLessThanOrEqual(sheetBox.x + sheetBox.width + TOL);

  const nudges = page.getByRole('switch', { name: 'Recaps and nudges' });
  await expect(nudges).toBeChecked();
  await nudges.click();
  await expect(nudges).not.toBeChecked();
  await nudges.click();
  await expect(nudges).toBeChecked();
  await expect(section).toHaveScreenshot('ai-settings-section.png', { maxDiffPixelRatio: 0.01 });
});
