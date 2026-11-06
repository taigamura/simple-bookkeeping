/**
 * The Entry sheet fits its screen (ADR-0004): on an ordinary iPhone the form
 * must show every control at once, with no scroll, including with the AI text
 * line (on-device model available, `?ai=fake`).
 *
 * Web viewports stand in for real iPhones: the web sheet container is the
 * window minus `WEB_FRAME_INSET` (50); the native container is the window
 * minus the top safe area, and the sheet also keeps the home-indicator inset.
 * So web height = points − top inset − bottom inset + 50.
 */
import { expect, test, type Page } from '@playwright/test';

import { OPEN_TIMEOUT, sheet } from './app';

const PHONES = [
  // name, width, native height, top inset, bottom inset
  { name: 'iPhone 16 Pro', width: 402, height: 874, top: 62, bottom: 34 },
  { name: 'iPhone 16', width: 393, height: 852, top: 59, bottom: 34 },
  { name: 'iPhone 13 mini', width: 375, height: 812, top: 50, bottom: 34, aiFits: false },
];

async function bodyOverflow(page: Page) {
  return page.getByTestId('entry-content').evaluate((content) => {
    // entry-content → content container → the scroll view.
    const scroll = content.parentElement!.parentElement!;
    return scroll.scrollHeight - scroll.clientHeight;
  });
}

for (const phone of PHONES) {
  // The mini with the AI line bottoms out at the control floors (keys 40pt,
  // rows 36pt) about 13pt short; there the last few points scroll (ADR-0004).
  for (const ai of phone.aiFits === false ? [false] : [true, false]) {
    test(`Entry fits without scrolling on ${phone.name}${ai ? ' with the AI line' : ''}`, async ({ page }) => {
      await page.setViewportSize({
        width: phone.width + 50,
        height: phone.height - phone.top - phone.bottom + 50,
      });
      await page.goto(ai ? '/?ai=fake' : '/');
      await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: OPEN_TIMEOUT });
      await page.getByLabel('Add entry', { exact: true }).click();
      const entry = sheet(page, 'entry-sheet');
      await expect(entry).toBeVisible({ timeout: OPEN_TIMEOUT });
      await expect(async () => {
        expect(await bodyOverflow(page), 'Entry body should not need a scroll').toBeLessThanOrEqual(1);
        // The bottom keypad row and the CTA are both on screen.
        const zero = (await entry.getByLabel('0', { exact: true }).boundingBox())!;
        const cta = (await entry.getByLabel('Add expense', { exact: true }).boundingBox())!;
        expect(zero.y + zero.height, '0 key above the CTA').toBeLessThanOrEqual(cta.y);
        expect(cta.y + cta.height, 'CTA on screen').toBeLessThanOrEqual(page.viewportSize()!.height);
      }).toPass({ timeout: OPEN_TIMEOUT });
    });
  }
}
