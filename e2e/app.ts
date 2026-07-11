/**
 * Shared driver for the sheet-regression suite (#58). Drives the exported Expo
 * web build exactly the way the user does: real page loads, taps at the
 * physical coordinates of the controls, no synthetic state.
 *
 * Selectors are the app's own accessibility labels (i18n/strings.ts, pinned to
 * en-US in playwright.config.ts) plus the three sheet testIDs threaded through
 * nav/BottomSheet.tsx — no bespoke test hooks beyond those anchors.
 */
import { expect, type Locator, type Page } from '@playwright/test';

/** How long a tapped sheet gets to become visible before we call the open failed. */
export const OPEN_TIMEOUT = 5_000;

export type SheetId = 'entry-sheet' | 'settings-sheet' | 'budgets-sheet';

/**
 * A fresh cold page load: navigate, then wait for the app to pass its
 * fonts/persisted-state gate (the tab bar's ＋ FAB appearing is that signal).
 * Returns the fixed screen coordinates of the ＋ FAB and the Settings gear so
 * callers can tap like a finger does — at the position, immediately, without
 * Playwright's stability waits softening the first-tap race.
 */
export async function coldLoad(page: Page) {
  await page.goto('/');
  const fab = page.getByLabel('Add entry', { exact: true });
  await expect(fab).toBeVisible();
  const gear = page.getByLabel('Settings', { exact: true });
  const fabBox = (await fab.boundingBox())!;
  const gearBox = (await gear.boundingBox())!;
  return {
    fab: { x: fabBox.x + fabBox.width / 2, y: fabBox.y + fabBox.height / 2 },
    gear: { x: gearBox.x + gearBox.width / 2, y: gearBox.y + gearBox.height / 2 },
  };
}

/** Raw tap at screen coordinates — no actionability waits, like a real finger. */
export async function tapAt(page: Page, point: { x: number; y: number }) {
  await page.mouse.click(point.x, point.y);
}

export function sheet(page: Page, id: SheetId): Locator {
  return page.getByTestId(id);
}

/** Assert the sheet's content view is visible and inside the viewport. */
export async function expectSheetOpen(
  page: Page,
  id: SheetId,
  message?: string,
) {
  const content = sheet(page, id);
  await expect(content, message).toBeVisible({ timeout: OPEN_TIMEOUT });
  const box = (await content.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.y, `${id} top edge should be on screen${message ? ` — ${message}` : ''}`)
    .toBeGreaterThanOrEqual(0);
  expect(
    box.y + box.height,
    `${id} should rise into the viewport, not sit collapsed below it${message ? ` — ${message}` : ''}`,
  ).toBeLessThanOrEqual(viewport.height + 1);
}

/** Wait for a sheet to be fully gone (gorhom unmounts children after dismiss). */
export async function expectSheetGone(page: Page, id: SheetId) {
  await expect(sheet(page, id)).toBeHidden({ timeout: OPEN_TIMEOUT });
}

/**
 * Dismiss the currently-open sheet by tapping the dimmed backdrop — a point
 * horizontally centered in the phone frame, safely above the sheet's top edge.
 */
export async function tapBackdrop(page: Page, id: SheetId) {
  const box = (await sheet(page, id).boundingBox())!;
  expect(box.y, 'need visible backdrop above the sheet to tap').toBeGreaterThan(70);
  await page.mouse.click(page.viewportSize()!.width / 2, box.y - 40);
}

/**
 * Ghost-overlay probe (#60): after a dismissal — or a failed open — a tap on a
 * calendar day must still register. If an invisible layer is eating taps, the
 * day never becomes selected and this fails.
 */
export async function expectCalendarTappable(page: Page, message?: string) {
  // Two candidate days so the probe works whatever day is already selected.
  for (const day of [3, 4]) {
    const cell = await visibleDay(page, day);
    if ((await cell.getAttribute('aria-selected')) === 'true') continue;
    await tapAt(page, await center(cell));
    await expect(
      cell,
      `calendar day ${day} tap did not register — tap-eating ghost overlay?${message ? ` — ${message}` : ''}`,
    ).toHaveAttribute('aria-selected', 'true', { timeout: 2_000 });
    return;
  }
  throw new Error('both probe days were already selected — cannot happen');
}

/**
 * The month pager keeps neighbor months mounted offscreen, so a day label can
 * match several cells; pick the one inside the viewport.
 */
export async function visibleDay(page: Page, day: number): Promise<Locator> {
  const cells = page.getByLabel(`Day ${day}`, { exact: true });
  const width = page.viewportSize()!.width;
  for (const cell of await cells.all()) {
    const box = await cell.boundingBox();
    if (box && box.x >= 0 && box.x + box.width <= width + 1) return cell;
  }
  throw new Error(`no on-screen calendar cell for day ${day}`);
}

export async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Dead zone below the sheet's content (#61): distance from the bottom of the
 * lowest rendered child to the bottom of the sheet's content view. With
 * dynamic content-height sizing this should be ~0 (the view's own bottom
 * padding is outside the children, so it never counts as dead zone).
 */
export async function deadZoneBelowContent(page: Page, id: SheetId): Promise<number> {
  return sheet(page, id).evaluate((el) => {
    // Deepest rendered boxes, not direct children: a fixed-height scroll
    // container would otherwise mask blank space under its last row. Scrollable
    // content extending past the sheet yields a negative gap — no dead zone.
    let maxBottom = Number.NEGATIVE_INFINITY;
    for (const c of el.querySelectorAll('*')) {
      if (c.children.length > 0) continue;
      const r = c.getBoundingClientRect();
      if (r.height > 0 && r.width > 0) maxBottom = Math.max(maxBottom, r.bottom);
    }
    if (maxBottom === Number.NEGATIVE_INFINITY) return Number.POSITIVE_INFINITY;
    return el.getBoundingClientRect().bottom - maxBottom;
  });
}
