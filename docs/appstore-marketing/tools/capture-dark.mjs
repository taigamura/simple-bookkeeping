import { firefox } from '@playwright/test';

const OUT = process.argv[2] || '/tmp/dark-calendar.png';
const LANG = process.argv[3] || 'en'; // 'en' | 'ja'
const URL = 'http://localhost:8090';
const DARK_BG = '#0e0f13';

const L = LANG === 'ja'
  ? { locale: 'ja-JP', tab: 'カレンダー', settings: '設定', loadSample: /サンプルデータを読み込む/, month: /6月|６月/, salary: /給料|給与/ }
  : { locale: 'en-US', tab: 'CALENDAR', settings: 'Settings', loadSample: /Load sample data/i, month: /June/, salary: /Salary/ };

const browser = await firefox.launch();
const ctx = await browser.newContext({
  viewport: { width: 440, height: 956 },
  deviceScaleFactor: 3,
  colorScheme: 'dark',
  locale: L.locale,
});
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept()); // window.confirm -> accept

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.getByText(L.tab, { exact: false }).first().waitFor({ timeout: 45000 });
await page.waitForTimeout(1500);

// --- seed the App Store sample data via Settings ---
async function tapText(rx) {
  const el = page.getByText(rx).first();
  await el.waitFor({ timeout: 8000 });
  const box = await el.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
// open settings (gear)
const gear = page.getByLabel(L.settings).first();
await gear.waitFor({ timeout: 8000 });
{ const b = await gear.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
await page.waitForTimeout(1200);

// scroll the settings sheet to the bottom so "Load sample data" is reachable.
// The wheel must be over the sheet's ScrollView, so move the cursor first.
await page.mouse.move(220, 600);
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 500); await page.waitForTimeout(150); }
await tapText(L.loadSample); // triggers window.confirm -> auto-accepted
await page.waitForTimeout(1600);

// should now be on the sample month with data; best-effort confirm
try { await page.getByText(L.month, { exact: false }).first().waitFor({ timeout: 8000 }); }
catch { console.log('month-text wait timed out; continuing'); }
await page.waitForTimeout(1200);

// --- flatten the web-only desktop frame to full-bleed ---
// A wrapper with bg rgb(38,38,48), ~25px padding and rounded corners insets
// the app on web. Neutralize it (and any ancestor carrying that frame color).
await page.evaluate((bg) => {
  document.documentElement.style.background = bg;
  document.body.style.margin = '0';
  document.body.style.background = bg;
  const FRAME = 'rgb(38, 38, 48)';
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.backgroundColor === FRAME) {
      el.style.setProperty('background', bg, 'important');
      el.style.setProperty('padding', '0', 'important');
      el.style.setProperty('border-radius', '0', 'important');
      el.style.setProperty('max-width', 'none', 'important');
      el.style.setProperty('width', '100%', 'important');
      el.style.setProperty('height', '100%', 'important');
      el.style.setProperty('box-shadow', 'none', 'important');
    }
  }
  // root wrappers fill the viewport
  const root = document.getElementById('root') || document.body.firstElementChild;
  if (root) {
    root.style.setProperty('background', bg, 'important');
    root.style.width = '100%'; root.style.height = '100%';
  }
  // Open a 45px (=135 device px) top gap for a composited iOS status bar by
  // bumping the screen container's top padding. The tab bar is a separate
  // sibling, so it stays pinned; the calendar's flex space absorbs the shift.
  for (const el of document.querySelectorAll('*')) {
    const p = getComputedStyle(el).padding;
    if (p.startsWith('12px 20px')) { el.style.setProperty('padding-top', '57px', 'important'); break; }
  }
}, DARK_BG);
await page.waitForTimeout(700);

const info = await page.evaluate(() => ({
  txt: document.body.innerText.slice(0, 40),
}));
console.log('info', JSON.stringify(info));

await page.screenshot({ path: OUT });
console.log('saved', OUT);
await browser.close();
