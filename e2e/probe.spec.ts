/** Throwaway diagnostic probe — dead, never committed. Safe to delete. */
import { test } from '@playwright/test';

import { center, coldLoad, tapAt, visibleDay } from './app';

test('probe: console/page errors on taps; do taps register; any sheet DOM?', async ({ page }) => {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`PROBE console.${msg.type()}: ${msg.text().slice(0, 500)}`);
    }
  });
  page.on('pageerror', (err) => {
    console.log(`PROBE pageerror: ${String(err).slice(0, 800)}`);
  });

  const { fab, gear } = await coldLoad(page);

  // 1. Does a plain calendar-day tap register? (isolates tap delivery)
  const day = await visibleDay(page, 3);
  await tapAt(page, await center(day));
  await page.waitForTimeout(800);
  console.log(`PROBE day-3 tap: aria-selected=${await day.getAttribute('aria-selected')}`);

  // 2. Gear tap → what appears in the DOM?
  await tapAt(page, gear);
  await page.waitForTimeout(4000);
  const afterGear = await page.evaluate(() => {
    const ids = ['entry-sheet', 'settings-sheet', 'budgets-sheet'];
    const found = ids.filter((id) => document.querySelector(`[data-testid="${id}"]`));
    const bodyChildren = [...document.body.children].map(
      (c) => `${c.tagName}#${c.id || '-'} cls=${(c.className || '').toString().slice(0, 50)}`,
    );
    const modalish = document.querySelectorAll(
      '[class*="portal" i], [id*="portal" i], [class*="modal" i], [aria-modal]',
    ).length;
    return { found, bodyChildren, modalish };
  });
  console.log(`PROBE after gear tap: ${JSON.stringify(afterGear)}`);

  // 3. Second gear tap on the same load — first-tap-only or total failure?
  await tapAt(page, gear);
  await page.waitForTimeout(4000);
  const second = await page.evaluate(() =>
    ['entry-sheet', 'settings-sheet', 'budgets-sheet'].filter((id) =>
      document.querySelector(`[data-testid="${id}"]`),
    ),
  );
  console.log(`PROBE after second gear tap: ${JSON.stringify(second)}`);

  // 4. FAB tap too.
  await tapAt(page, fab);
  await page.waitForTimeout(4000);
  const afterFab = await page.evaluate(() =>
    ['entry-sheet', 'settings-sheet', 'budgets-sheet'].filter((id) =>
      document.querySelector(`[data-testid="${id}"]`),
    ),
  );
  console.log(`PROBE after fab tap: ${JSON.stringify(afterFab)}`);

  // 5. Locator-level click with Playwright's own actionability, as contrast.
  await page.getByLabel('Settings', { exact: true }).click();
  await page.waitForTimeout(4000);
  const afterLocatorClick = await page.evaluate(() =>
    ['entry-sheet', 'settings-sheet', 'budgets-sheet'].filter((id) =>
      document.querySelector(`[data-testid="${id}"]`),
    ),
  );
  console.log(`PROBE after locator click on gear: ${JSON.stringify(afterLocatorClick)}`);
});
