/* Verification driver for #47 — drives the Expo web build with Playwright.
 * Temporary file; deleted after the verification run. */
const { chromium } = require('/home/taigamura/.nvm/versions/node/v20.20.2/lib/node_modules/@playwright/mcp/node_modules/playwright');

const SHOT_DIR = process.cwd();
const shot = (n) => `${SHOT_DIR}/verify-${n}.png`;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({
    executablePath:
      '/home/taigamura/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const logs = [];
  page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  const step = async (name, fn) => {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (e) {
      console.log(`FAIL ${name}: ${e.message.split('\n')[0]}`);
      process.exitCode = 1;
    }
  };

  await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 120000 });
  // First bundle compile can be slow; wait for the tab bar to exist.
  await page.getByLabel('Add entry').waitFor({ timeout: 120000 });
  await page.screenshot({ path: shot('01-fresh') });

  // 1. Fresh launch -> tap + immediately (no Settings cycle first).
  await step('entry sheet opens first thing after launch', async () => {
    await page.getByLabel('Add entry').click();
    await pause(900); // spring-in
    const cta = page.getByText('Add expense');
    await cta.waitFor({ timeout: 3000 });
    const box = await cta.boundingBox();
    if (!box || box.y > 900 || box.height < 5) {
      throw new Error(`CTA not visibly on screen: ${JSON.stringify(box)}`);
    }
    await page.screenshot({ path: shot('02-entry-first-open') });
  });

  // 2. Dismiss via backdrop tap, then reopen — repeatability.
  await step('entry sheet dismisses on backdrop tap and reopens', async () => {
    await page.mouse.click(210, 120); // backdrop area above the sheet
    await pause(900);
    if (await page.getByText('Add expense').isVisible().catch(() => false)) {
      throw new Error('entry sheet still visible after backdrop tap');
    }
    await page.getByLabel('Add entry').click();
    await pause(900);
    await page.getByText('Add expense').waitFor({ timeout: 3000 });
    await page.screenshot({ path: shot('03-entry-reopen') });
    await page.mouse.click(210, 120);
    await pause(900);
  });

  // 3. Settings sheet: content on the very first open.
  await step('settings sheet renders content on very first open', async () => {
    await page.getByLabel('Settings').click();
    await pause(900);
    const done = page.getByText('Done');
    await done.waitFor({ timeout: 3000 });
    const box = await done.boundingBox();
    if (!box || box.height < 5) throw new Error(`Done button not laid out: ${JSON.stringify(box)}`);
    await page.screenshot({ path: shot('04-settings-first-open') });
  });

  // 4. Close settings via Done, reopen entry — the old "dead +" repro order,
  //    inverted: + must not NEED this cycle, but must still work after it.
  await step('done closes settings; + still works after the cycle', async () => {
    await page.getByText('Done').click();
    await pause(900);
    await page.getByLabel('Add entry').click();
    await pause(900);
    await page.getByText('Add expense').waitFor({ timeout: 3000 });
    await page.mouse.click(210, 120);
    await pause(900);
  });

  // 5. Probe: rapid open/dismiss/open — presents/dismisses racing each other.
  await step('probe: rapid +, backdrop, + again still lands open with content', async () => {
    await page.getByLabel('Add entry').click();
    await pause(150);
    await page.mouse.click(210, 80);
    await pause(150);
    await page.getByLabel('Add entry').click();
    await pause(1200);
    await page.getByText('Add expense').waitFor({ timeout: 3000 });
    await page.screenshot({ path: shot('05-rapid-reopen') });
    await page.mouse.click(210, 80);
    await pause(900);
  });

  // 6. Probe: edit-mode chrome must survive the dismiss animation (editing is
  //    no longer cleared on close). Load sample data, open an entry row, then
  //    backdrop-dismiss and watch for the Delete row flicker... then reopen
  //    via + and confirm create mode (no Delete row).
  await step('probe: edit open -> dismiss -> + gives create mode', async () => {
    await page.getByLabel('Settings').click();
    await pause(900);
    page.once('dialog', (d) => d.accept()); // confirm sample-load if dialog-based
    await page.getByText('Load sample data').click().catch(() => {});
    await pause(900);
    // Tap the first day-list row that shows an entry (sample jumps to Jul 2026, day 1).
    const row = page.getByText('¥', { exact: false }).first();
    await row.click().catch(() => {});
    await pause(900);
    const editOpen = await page.getByText('Save').isVisible().catch(() => false);
    if (editOpen) {
      await page.mouse.click(210, 80); // dismiss the edit sheet
      await pause(900);
    }
    await page.getByLabel('Add entry').click();
    await pause(900);
    await page.getByText('Add expense').waitFor({ timeout: 3000 });
    const del = await page.getByText('Delete entry').isVisible().catch(() => false);
    if (del) throw new Error('create-mode entry sheet shows edit-mode Delete row');
    await page.screenshot({ path: shot('06-create-after-edit') });
  });

  const errors = logs.filter((l) => l.startsWith('[pageerror]') || l.includes('[console.error]'));
  if (errors.length) console.log('CONSOLE ERRORS:\n' + errors.join('\n'));
  else console.log('No page errors captured.');

  await browser.close();
})().catch((e) => {
  console.error('DRIVER CRASH:', e);
  process.exit(2);
});
