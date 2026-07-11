/**
 * Sheet-regression suite (#58) — the repo's permanent red-first e2e fixture.
 *
 * ── RED-FIRST CONTRACT ──────────────────────────────────────────────────────
 * Tests marked `test.fail()` reproduce real, currently-shipping Build 7 bugs
 * (#60/#61/#62) against main. Playwright inverts them: they keep CI green only
 * while the bug exists, and start failing CI the moment the bug is fixed —
 * forcing the fixing PR (#60 and friends) to flip each marker to a plain
 * passing test. Removing or skipping any test here is treated exactly like
 * deleting the unit suite. A marked test that "passes unexpectedly" means the
 * bug stopped reproducing: either the fix landed (flip the marker) or the
 * scenario drifted off the real bug (rewrite it — do not delete it).
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
      await tapAt(page, await center(row));
      await expectSheetOpen(page, 'budgets-sheet', `attempt #${i}`);
    }
  });
});

test.describe('dismiss → immediate reopen', () => {
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

  test('budgets-sheet: content fills the sheet, no dead zone', async ({ page }) => {
    const { gear } = await coldLoad(page);
    await tapAt(page, gear);
    await expectSheetOpen(page, 'settings-sheet');
    const row = sheet(page, 'settings-sheet').getByLabel('Budgets', { exact: true });
    await tapAt(page, await center(row));
    await expectSheetOpen(page, 'budgets-sheet');
    const box = (await sheet(page, 'budgets-sheet').boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.y + box.height).toBeGreaterThanOrEqual(viewport.height - 80);
    expect(await deadZoneBelowContent(page, 'budgets-sheet')).toBeLessThanOrEqual(DEAD_ZONE_TOLERANCE);
  });
});
