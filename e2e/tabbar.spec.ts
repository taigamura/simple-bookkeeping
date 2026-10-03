/**
 * Tab bar visual regression — the floating Liquid Glass bar's selection lens.
 *
 * The lens is ONE absolutely-positioned element that slides between the two
 * tabs' measured frames. Its placement is pure layout math (onLayout frames +
 * insets), so it is exactly the kind of bug unit tests can't see: jest has no
 * layout engine. The first Liquid Glass build shipped the lens riding 7px above the tabs (it was
 * anchored to the row's padding edge, not its content box) and, on Summary,
 * shifted right and over-wide (it reused Calendar's width; the labels differ).
 *
 * Two layers of protection:
 *  - Geometry: the lens must be centred on the active tab on both axes and sized
 *    to that tab. Tolerant of fonts/sub-pixels, strict about misplacement.
 *  - Screenshot: a pixel baseline of the bar per tab, so any visual drift the
 *    geometry checks don't describe (material, colour, clipping) shows up as a
 *    diff. Refresh deliberately with `--update-snapshots` after an intended
 *    visual change, and look at the new PNG before committing it.
 *
 * The real iOS 26 glass material does not render on web (GlassView degrades to
 * a View), but the lens geometry is shared by every platform, so web pins it.
 */
import { expect, test, type Page } from '@playwright/test';

import { coldLoad } from './app';

/** Sub-pixel/font slack. The shipped bug was 4–7.5px off, well outside this. */
const TOLERANCE = 1.5;

async function selectTab(page: Page, name: 'Calendar' | 'Summary') {
  const tab = page.getByRole('tab', { name, exact: true });
  await tab.click();
  const lens = page.getByTestId('tab-lens');
  // Let the slide spring settle: retry until the lens has stopped on the tab.
  await expect(async () => {
    const t = (await tab.boundingBox())!;
    const l = (await lens.boundingBox())!;
    expect(Math.abs(l.x + l.width / 2 - (t.x + t.width / 2))).toBeLessThan(TOLERANCE);
  }).toPass({ timeout: 5_000 });
  return { tab: (await tab.boundingBox())!, lens: (await lens.boundingBox())! };
}

for (const name of ['Calendar', 'Summary'] as const) {
  test(`selection lens is centred on and sized to the active ${name} tab`, async ({ page }) => {
    await coldLoad(page);
    if (name === 'Summary') await selectTab(page, 'Calendar');
    const { tab, lens } = await selectTab(page, name);
    const fab = (await page.getByLabel('Add entry', { exact: true }).boundingBox())!;

    const lensCy = lens.y + lens.height / 2;
    expect(Math.abs(lensCy - (tab.y + tab.height / 2)), 'lens is vertically centred on the tab').toBeLessThan(
      TOLERANCE,
    );
    expect(Math.abs(lensCy - (fab.y + fab.height / 2)), 'lens sits level with the ＋').toBeLessThan(
      TOLERANCE,
    );
    expect(lens.x, 'lens starts inside the tab').toBeGreaterThanOrEqual(tab.x - TOLERANCE);
    expect(lens.x + lens.width, 'lens ends inside the tab').toBeLessThanOrEqual(
      tab.x + tab.width + TOLERANCE,
    );

    await expect(page.getByTestId('tab-bar')).toHaveScreenshot(`tabbar-${name.toLowerCase()}.png`, {
      maxDiffPixelRatio: 0.02,
    });
  });
}
