/**
 * Calendar pulse + selection regressions (real reanimated only).
 *
 * These two bugs are invisible to the jest unit suite: the reanimated jest mock
 * resolves springs synchronously and never fires their finish callbacks, so the
 * landing-pulse ring's resting opacity — the whole point below — can't be
 * observed there. They live here, against the exported web build, where the
 * animations actually run.
 *
 *  1. The landing-pulse ring must play once and then rest INVISIBLE. A prior
 *     build reset the shared progress to 0 on finish (opacity 0.7) and started
 *     it at 0, so every day an entry was ever saved on kept a permanent blue
 *     outline — read on the calendar as a second "today" ring.
 *  2. Exactly one day is selected at a time. The month pager used to preview the
 *     carried-over selection on its neighbour pages, painting a second blue day.
 */
import { expect, test } from '@playwright/test';

import { center, coldLoad, expectSheetGone, expectSheetOpen, sheet, tapAt } from './app';

// The pulse ring is motion-gated (MotionProvider reads prefers-reduced-motion),
// so force motion on before the app loads or DayCell renders no ring and the
// test is vacuous.
async function enableMotion(page: import('@playwright/test').Page) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}

/** Highest opacity among the mounted landing-pulse rings (0 when none show). */
function maxRingOpacity(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    let max = 0;
    for (const el of document.querySelectorAll('[data-testid^="day-pulse-ring-"]')) {
      max = Math.max(max, parseFloat(getComputedStyle(el as HTMLElement).opacity) || 0);
    }
    return max;
  });
}

/** How many day cells paint a full-cover selection layer (the accent tile). */
function selectedDayCount(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    let n = 0;
    for (const cell of document.querySelectorAll('[aria-label^="Day "]')) {
      const rect = cell.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area === 0) continue;
      for (const child of cell.querySelectorAll('*')) {
        const cs = getComputedStyle(child as HTMLElement);
        const bg = cs.backgroundColor;
        if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
        if (parseFloat(cs.opacity) < 0.5) continue;
        const r = child.getBoundingClientRect();
        if (r.width * r.height >= area * 0.9) { n++; break; }
      }
    }
    return n;
  });
}

async function saveAnEntry(page: import('@playwright/test').Page) {
  await enableMotion(page);
  const { fab } = await coldLoad(page);
  await tapAt(page, fab);
  await expectSheetOpen(page, 'entry-sheet');
  const s = sheet(page, 'entry-sheet');
  await tapAt(page, await center(s.getByLabel('5', { exact: true })));
  await tapAt(page, await center(s.getByLabel('Add expense', { exact: true })));
  await expectSheetGone(page, 'entry-sheet');
}

test('the landing pulse fades out and never rests as a stray outline', async ({ page }) => {
  await saveAnEntry(page);

  // The pulse fired: a ring element mounted on the saved day (precondition, so
  // the rest-state check below isn't vacuously green with motion off).
  await expect(page.locator('[data-testid^="day-pulse-ring-"]').first()).toBeAttached({
    timeout: 4000,
  });

  // It fades and STAYS faded (the bug left it at 0.7).
  await expect.poll(() => maxRingOpacity(page), { timeout: 4000 }).toBeLessThan(0.05);

  // Re-mounting the cell — leave Calendar for Summary, come back — must not
  // repaint the ring (the init-to-0 half of the bug).
  await tapAt(page, await center(page.getByLabel('Summary', { exact: true })));
  await tapAt(page, await center(page.getByLabel('Calendar', { exact: true })));
  await expect.poll(() => maxRingOpacity(page), { timeout: 4000 }).toBeLessThan(0.05);
});

test('only one day is selected, before and after paging a month', async ({ page }) => {
  await enableMotion(page);
  await coldLoad(page);
  expect(await selectedDayCount(page)).toBe(1);

  await tapAt(page, await center(page.getByLabel('Next month', { exact: true })));
  await page.waitForTimeout(1200); // let the pager settle
  expect(await selectedDayCount(page)).toBe(1);
});
