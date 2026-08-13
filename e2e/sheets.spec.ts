/**
 * Sheet-regression suite (#58) — the repo's permanent e2e fixture.
 *
 * ── HISTORY: THE RED-FIRST CONTRACT ─────────────────────────────────────────
 * These scenarios were written against real, shipping Build 7 bugs
 * (#60/#61/#62) and marked `test.fail()`, so they kept CI green only while the
 * bug existed and went red the moment it was fixed — forcing the fixing PR to
 * flip each marker to a plain passing test. All three are fixed and closed, so
 * every marker is now flipped and the suite passes on its own terms. That is a
 * release gate: no `test.fail()` or `test.skip()` may reappear here without the
 * open bug to justify it. Removing a test is treated exactly like deleting the
 * unit suite — if a scenario drifts off the behaviour it guards, rewrite it.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Scenarios (PRD #57 → issue #58):
 *   1. Cold load → first tap on ＋ → Entry sheet present (repeated fresh loads)
 *   2. Cold load → first tap on ⚙ → Settings sheet present (same repetition)
 *   3. Settings → Budgets row → Budgets sheet present, 10/10
 *   4. Open → dismiss (backdrop / close button) → immediately reopen; plus the
 *      swap sequences entry→settings, settings→entry, settings⇄budgets
 *   5. Ghost overlay: after every dismissal a calendar-day tap must register
 *   6. Sheet geometry: content fills the sheet, no dead zone below the content
 */
import { expect, test } from '@playwright/test';

import {
  center,
  coldLoad,
  deadZoneBelowContent,
  OPEN_TIMEOUT,
  expectCalendarTappable,
  expectSheetGone,
  expectSheetOpen,
  sheet,
  tapAt,
  tapBackdrop,
} from './app';

/** Fresh page loads per cold-start scenario — enough to make the probabilistic
 * first-tap failure deterministic in practice. */
const COLD_LOADS = 12;

/** Allowed gap under the last rendered content inside a sheet (the sheet's own
 * 28px bottom padding plus breathing room). */
const DEAD_ZONE_TOLERANCE = 80;

async function expectSheetHeadingInViewport(
  page: Parameters<typeof sheet>[0],
  id: Parameters<typeof sheet>[1],
  title: string,
) {
  const heading = sheet(page, id).getByText(title, { exact: true }).first();
  await expect(heading).toBeVisible();
  const viewport = page.viewportSize()!;
  await expect(async () => {
    const box = (await heading.boundingBox())!;
    expect(box.y, `${title} heading should not be pushed above the viewport`).toBeGreaterThanOrEqual(24);
    expect(box.y + box.height, `${title} heading should be visible`).toBeLessThan(viewport.height);
  }).toPass({ timeout: OPEN_TIMEOUT });
}

async function expectEveryButtonAccessible(
  page: Parameters<typeof sheet>[0],
  id: Parameters<typeof sheet>[1],
  finalActionLabel: string,
) {
  await expectSheetOpen(page, id);
  const surface = sheet(page, id);
  const surfaceBox = (await surface.boundingBox())!;
  const buttons = await surface.getByRole('button').all();
  expect(buttons.length, `${id} should expose at least one button`).toBeGreaterThan(0);

  for (const button of buttons) {
    const box = (await button.boundingBox())!;
    const label = (await button.getAttribute('aria-label')) ?? 'unlabelled button';
    expect(box.x, `${label} should not clip on the left`).toBeGreaterThanOrEqual(surfaceBox.x);
    expect(box.x + box.width, `${label} should not clip on the right`)
      .toBeLessThanOrEqual(surfaceBox.x + surfaceBox.width);
    expect(box.y, `${label} should not clip above the sheet`).toBeGreaterThanOrEqual(surfaceBox.y);
    expect(box.y + box.height, `${label} should not clip below the sheet`)
      .toBeLessThanOrEqual(surfaceBox.y + surfaceBox.height);
  }

  const finalAction = surface.getByLabel(finalActionLabel, { exact: true });
  const actionBox = (await finalAction.boundingBox())!;
  const bottomClearance = surfaceBox.y + surfaceBox.height - (actionBox.y + actionBox.height);
  expect(bottomClearance, `${finalActionLabel} should retain bottom breathing room`)
    .toBeGreaterThanOrEqual(28);
  expect(bottomClearance, `${finalActionLabel} should not leave an oversized bottom gap`)
    .toBeLessThanOrEqual(48);
}

test('Settings, Repeats, and Budgets render visible bodies after opening and drill-in', async ({ page }) => {
  const { gear } = await coldLoad(page);
  await tapAt(page, gear);
  await expectSheetHeadingInViewport(page, 'settings-sheet', 'Settings');
  const defaultHeight = (await sheet(page, 'settings-sheet').boundingBox())!.height;

  const repeats = sheet(page, 'settings-sheet').getByLabel('Repeats', { exact: true });
  await repeats.scrollIntoViewIfNeeded();
  await tapAt(page, await center(repeats));
  await expectSheetHeadingInViewport(page, 'repeats-sheet', 'Repeats');
  await expect(sheet(page, 'repeats-sheet').getByText('No active repeats')).toBeVisible();
  expect((await sheet(page, 'repeats-sheet').boundingBox())!.height).toBeCloseTo(defaultHeight, 0);

  await tapAt(page, await center(sheet(page, 'repeats-sheet').getByLabel('Back', { exact: true })));
  await expectSheetHeadingInViewport(page, 'settings-sheet', 'Settings');
  expect((await sheet(page, 'settings-sheet').boundingBox())!.height).toBeCloseTo(defaultHeight, 0);

  const budgets = sheet(page, 'settings-sheet').getByLabel('Budgets', { exact: true });
  await budgets.scrollIntoViewIfNeeded();
  await tapAt(page, await center(budgets));
  await expectSheetHeadingInViewport(page, 'budgets-sheet', 'Budgets');
  expect((await sheet(page, 'budgets-sheet').boundingBox())!.height).toBeCloseTo(defaultHeight, 0);
});

test('Settings can scroll through the final Data action', async ({ page }) => {
  const { gear } = await coldLoad(page);
  await tapAt(page, gear);
  await expectSheetHeadingInViewport(page, 'settings-sheet', 'Settings');

  const settings = sheet(page, 'settings-sheet');
  const finalDataAction = settings.getByLabel('Delete all data', { exact: true });
  const viewport = page.viewportSize()!;
  await page.mouse.move(viewport.width / 2, viewport.height - 120);
  await page.mouse.wheel(0, 2_000);

  await expect(async () => {
    const actionBox = (await finalDataAction.boundingBox())!;
    expect(actionBox.y + actionBox.height, 'final Data action should scroll fully inside the viewport')
      .toBeLessThanOrEqual(viewport.height);
  }).toPass({ timeout: OPEN_TIMEOUT });
});

test('Entry opens with its non-scrollable primary action fully accessible', async ({ page }) => {
  const { fab } = await coldLoad(page);
  await tapAt(page, fab);
  const entry = sheet(page, 'entry-sheet');
  await expect(entry).toBeVisible({ timeout: OPEN_TIMEOUT });
  const primaryAction = entry.getByLabel('Add expense', { exact: true });
  await expect(async () => {
    const surface = (await entry.boundingBox())!;
    const action = (await primaryAction.boundingBox())!;
    expect(action.x, 'Entry primary action should not clip on the left').toBeGreaterThanOrEqual(surface.x);
    expect(action.x + action.width, 'Entry primary action should not clip on the right')
      .toBeLessThanOrEqual(surface.x + surface.width);
    expect(action.y, 'Entry primary action should not clip above the sheet').toBeGreaterThanOrEqual(surface.y);
    const bottomClearance = surface.y + surface.height - (action.y + action.height);
    expect(
      bottomClearance,
      'Entry primary action should retain its full 28px bottom breathing room',
    ).toBeGreaterThanOrEqual(28);
    expect(bottomClearance, 'Entry should not leave an oversized gap below its primary action')
      .toBeLessThanOrEqual(48);
  }).toPass({ timeout: OPEN_TIMEOUT });
});

test('Entry and repeat editing grow to keep every button accessible without scrolling', async ({ page }) => {
  const { fab, gear } = await coldLoad(page);
  await tapAt(page, fab);
  const entry = sheet(page, 'entry-sheet');
  await expect(entry).toBeVisible({ timeout: OPEN_TIMEOUT });
  await expectEveryButtonAccessible(page, 'entry-sheet', 'Add expense');

  await tapAt(page, await center(entry.getByLabel('↻ Repeat: Never', { exact: true })));
  await tapAt(page, await center(entry.getByLabel('↻ Repeat: Every day', { exact: true })));
  await expect(entry.getByLabel('If on weekend: Move to Monday', { exact: true })).toBeVisible();
  await expectEveryButtonAccessible(page, 'entry-sheet', 'Add expense');

  await tapAt(page, await center(entry.getByLabel('1', { exact: true })));
  await tapAt(page, await center(entry.getByLabel('Add expense', { exact: true })));
  await expectSheetGone(page, 'entry-sheet');

  await tapAt(page, gear);
  await expectSheetHeadingInViewport(page, 'settings-sheet', 'Settings');
  const repeats = sheet(page, 'settings-sheet').getByLabel('Repeats', { exact: true });
  await repeats.scrollIntoViewIfNeeded();
  await tapAt(page, await center(repeats));
  await expectSheetHeadingInViewport(page, 'repeats-sheet', 'Repeats');
  await tapAt(page, await center(sheet(page, 'repeats-sheet').getByLabel(/^Edit repeat:/)));

  const editor = sheet(page, 'repeat-entry-sheet');
  await expect(editor.getByLabel('Save this and future', { exact: true })).toBeVisible();
  await expect(editor.getByLabel('Stop repeat', { exact: true })).toBeVisible();
  await expectEveryButtonAccessible(page, 'repeat-entry-sheet', 'Stop repeat');
});

test.describe('cold-load first tap', () => {
  test(`＋ opens the Entry sheet on the first tap, ${COLD_LOADS}/${COLD_LOADS} fresh loads`, async ({ page }) => {
    for (let i = 1; i <= COLD_LOADS; i++) {
      const { fab } = await coldLoad(page);
      await tapAt(page, fab);
      await expectSheetOpen(page, 'entry-sheet', `cold load #${i}`);
    }
  });

  test(`⚙ opens the Settings sheet on the first tap, ${COLD_LOADS}/${COLD_LOADS} fresh loads`, async ({ page }) => {
    for (let i = 1; i <= COLD_LOADS; i++) {
      const { gear } = await coldLoad(page);
      await tapAt(page, gear);
      await expectSheetOpen(page, 'settings-sheet', `cold load #${i}`);
    }
  });
});

test.describe('Budgets from Settings', () => {
  test('Budgets row opens the Budgets sheet, 10/10', async ({ page }) => {
    for (let i = 1; i <= 10; i++) {
      const { gear } = await coldLoad(page);
      await tapAt(page, gear);
      await expectSheetOpen(page, 'settings-sheet', `attempt #${i}`);
      const row = sheet(page, 'settings-sheet').getByLabel('Budgets', { exact: true });
      // Settings scrolls on this viewport (#61/#63); bring the row fully into the
      // sheet before tapping so its center isn't in the clipped bottom padding.
      await row.scrollIntoViewIfNeeded();
      await tapAt(page, await center(row));
      await expectSheetOpen(page, 'budgets-sheet', `attempt #${i}`);
    }
  });
});

test.describe('dismiss → immediate reopen', () => {
  test('Entry: meaningful downward drag from the top band dismisses', async ({ page }) => {
    const { fab } = await coldLoad(page);
    await tapAt(page, fab);
    await expectSheetOpen(page, 'entry-sheet');

    const entry = sheet(page, 'entry-sheet');
    const box = (await entry.boundingBox())!;
    const x = box.x + box.width / 2;
    await page.mouse.move(x, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(x, box.y + 180, { steps: 8 });
    await page.mouse.up();
    await expectSheetGone(page, 'entry-sheet');
  });

  test('Entry: backdrop dismiss, then reopen', async ({ page }) => {
    const { fab } = await coldLoad(page);
    await tapAt(page, fab);
    await expectSheetOpen(page, 'entry-sheet');
    await tapBackdrop(page, 'entry-sheet');
    await expectSheetGone(page, 'entry-sheet');
    await tapAt(page, fab);
    await expectSheetOpen(page, 'entry-sheet', 'reopen after backdrop dismiss');
    await tapBackdrop(page, 'entry-sheet');
    await expectSheetGone(page, 'entry-sheet');
    await expectCalendarTappable(page, 'after Entry backdrop dismissals');
  });

  test('Entry: ✕ close, then reopen', async ({ page }) => {
    const { fab } = await coldLoad(page);
    await tapAt(page, fab);
    await expectSheetOpen(page, 'entry-sheet');
    const close = sheet(page, 'entry-sheet').getByLabel('Close', { exact: true });
    await tapAt(page, await center(close));
    await expectSheetGone(page, 'entry-sheet');
    await tapAt(page, fab);
    await expectSheetOpen(page, 'entry-sheet', 'reopen after ✕ close');
    await tapAt(page, await center(sheet(page, 'entry-sheet').getByLabel('Close', { exact: true })));
    await expectSheetGone(page, 'entry-sheet');
    await expectCalendarTappable(page, 'after Entry ✕ dismissals');
  });

  test('Settings: backdrop dismiss, then reopen', async ({ page }) => {
    const { gear } = await coldLoad(page);
    await tapAt(page, gear);
    await expectSheetOpen(page, 'settings-sheet');
    await tapBackdrop(page, 'settings-sheet');
    await expectSheetGone(page, 'settings-sheet');
    await tapAt(page, gear);
    await expectSheetOpen(page, 'settings-sheet', 'reopen after backdrop dismiss');
    await tapBackdrop(page, 'settings-sheet');
    await expectSheetGone(page, 'settings-sheet');
    await expectCalendarTappable(page, 'after Settings backdrop dismissals');
  });

  test('Settings: ✕ close, then reopen (#59)', async ({ page }) => {
    const { gear } = await coldLoad(page);
    await tapAt(page, gear);
    await expectSheetOpen(page, 'settings-sheet');
    const close = sheet(page, 'settings-sheet').getByLabel('Close', { exact: true });
    await tapAt(page, await center(close));
    await expectSheetGone(page, 'settings-sheet');
    await tapAt(page, gear);
    await expectSheetOpen(page, 'settings-sheet', 'reopen after ✕ close');
    await tapAt(page, await center(sheet(page, 'settings-sheet').getByLabel('Close', { exact: true })));
    await expectSheetGone(page, 'settings-sheet');
    await expectCalendarTappable(page, 'after Settings ✕ dismissals');
  });
});

test.describe('sheet swaps', () => {
  test('entry→settings: ⚙ tapped right as the Entry sheet dismisses', async ({ page }) => {
    const { fab, gear } = await coldLoad(page);
    await tapAt(page, fab);
    await expectSheetOpen(page, 'entry-sheet');
    await tapBackdrop(page, 'entry-sheet');
    // No settling wait: the tap lands while the Entry sheet is animating out,
    // exactly the sequence the #53 guard exists for.
    await tapAt(page, gear);
    await expectSheetOpen(page, 'settings-sheet', 'swap entry→settings');
  });

  test('settings→entry: ＋ tapped right as the Settings sheet dismisses', async ({ page }) => {
    const { fab, gear } = await coldLoad(page);
    await tapAt(page, gear);
    await expectSheetOpen(page, 'settings-sheet');
    await tapBackdrop(page, 'settings-sheet');
    await tapAt(page, fab);
    await expectSheetOpen(page, 'entry-sheet', 'swap settings→entry');
  });

  test('settings⇄budgets: three round trips (#59)', async ({ page }) => {
    const { gear } = await coldLoad(page);
    await tapAt(page, gear);
    await expectSheetOpen(page, 'settings-sheet');
    for (let i = 1; i <= 3; i++) {
      const row = sheet(page, 'settings-sheet').getByLabel('Budgets', { exact: true });
      // Settings scrolls on this viewport (#61/#63); bring the row fully into the
      // sheet before tapping so its center isn't in the clipped bottom padding.
      await row.scrollIntoViewIfNeeded();
      await tapAt(page, await center(row));
      await expectSheetOpen(page, 'budgets-sheet', `round trip #${i}`);
      const back = sheet(page, 'budgets-sheet').getByLabel('Back', { exact: true });
      await tapAt(page, await center(back));
      await expectSheetOpen(page, 'settings-sheet', `back to Settings, round trip #${i}`);
    }
  });
});

test.describe('ghost overlay', () => {
  test('calendar day taps register after every dismissal path', async ({ page }) => {
    const { fab, gear } = await coldLoad(page);

    await tapAt(page, fab);
    await expectSheetOpen(page, 'entry-sheet');
    await tapBackdrop(page, 'entry-sheet');
    await expectSheetGone(page, 'entry-sheet');
    await expectCalendarTappable(page, 'after Entry backdrop dismiss');

    await tapAt(page, fab);
    await expectSheetOpen(page, 'entry-sheet');
    await tapAt(page, await center(sheet(page, 'entry-sheet').getByLabel('Close', { exact: true })));
    await expectSheetGone(page, 'entry-sheet');
    await expectCalendarTappable(page, 'after Entry ✕ close');

    await tapAt(page, gear);
    await expectSheetOpen(page, 'settings-sheet');
    await tapBackdrop(page, 'settings-sheet');
    await expectSheetGone(page, 'settings-sheet');
    await expectCalendarTappable(page, 'after Settings backdrop dismiss');

    await tapAt(page, gear);
    await expectSheetOpen(page, 'settings-sheet');
    await tapAt(page, await center(sheet(page, 'settings-sheet').getByLabel('Close', { exact: true })));
    await expectSheetGone(page, 'settings-sheet');
    await expectCalendarTappable(page, 'after Settings ✕ close');
  });
});

test.describe('sheet geometry', () => {
  for (const [id, open] of [
    ['entry-sheet', 'fab'],
    ['settings-sheet', 'gear'],
  ] as const) {
    test(`${id}: content fills the sheet, no dead zone`, async ({ page }) => {
      const points = await coldLoad(page);
      await tapAt(page, points[open]);
      await expectSheetOpen(page, id);
      const box = (await sheet(page, id).boundingBox())!;
      const viewport = page.viewportSize()!;
      // Bottom-anchored: the content's bottom edge must sit at the phone
      // frame's bottom (viewport minus the web backdrop padding), not float.
      expect(box.y + box.height).toBeGreaterThanOrEqual(viewport.height - 80);
      expect(await deadZoneBelowContent(page, id)).toBeLessThanOrEqual(DEAD_ZONE_TOLERANCE);
    });
  }

  // Budgets is a fixed-height drill-in like Repeats: it opens at the shared
  // Settings detent (asserted by the render-visible-bodies test above), so short
  // content leaves breathing room below rather than filling to the bottom — there
  // is no dead-zone check here for the same reason Repeats has none. It must still
  // bottom-anchor to the frame, not float.
  test('budgets-sheet: bottom-anchored at the shared Settings detent', async ({ page }) => {
    const { gear } = await coldLoad(page);
    await tapAt(page, gear);
    await expectSheetOpen(page, 'settings-sheet');
    const row = sheet(page, 'settings-sheet').getByLabel('Budgets', { exact: true });
    // Settings scrolls on this viewport (#61/#63); bring the row fully into the
    // sheet before tapping so its center isn't in the clipped bottom padding.
    await row.scrollIntoViewIfNeeded();
    await tapAt(page, await center(row));
    await expectSheetOpen(page, 'budgets-sheet');
    const box = (await sheet(page, 'budgets-sheet').boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.y + box.height).toBeGreaterThanOrEqual(viewport.height - 80);
  });
});
