// Usage: node cap.mjs <en|ja> <shot> [outDir]
import { createRequire } from 'module';
const require = createRequire('/home/taigamura/dev/simple-bookkeeping/');
const { chromium } = require('@playwright/test');

const LANG = process.argv[2];
const SHOT = process.argv[3];
const OUT = process.argv[4] || '/tmp/claude-1000/-home-taigamura-dev-simple-bookkeeping/b373f8c4-74f5-483c-9cef-572da0f48986/scratchpad/shots/raw';
const JA = LANG === 'ja';
const BASE = 'http://localhost:4180';
const TODAY = new Date('2026-10-20T10:00:00');
const TOP = 62; // CSS px reserved for the composited iOS status bar

const T = JA
  ? {
      locale: 'ja-JP', addEntry: '入力を追加', line: 'ことばで入力', text: '昨日ランチ 850円',
      scan: 'レシートを読み取る', day: (d) => `${d}日`, summary: 'サマリー', calendar: 'カレンダー',
    }
  : {
      locale: 'en-US', addEntry: 'Add entry', line: 'Describe the entry in words', text: 'lunch 850 yesterday',
      scan: 'Scan a receipt', day: (d) => `Day ${d}`, summary: 'Summary', calendar: 'Calendar',
    };

// ── Seed: a realistic three-month ledger (Aug–Oct 2026, today = Tue 20 Oct) ──
function seed() {
  const c = JA
    ? { food: '食費', rent: '家賃', tr: '交通費', shop: '買い物', util: '光熱費', phone: '通信費', health: '医療費', fun: '娯楽', sal: '給料', bonus: '賞与', other: 'その他' }
    : { food: 'Food', rent: 'Rent', tr: 'Transport', shop: 'Shopping', util: 'Bills', phone: 'Bills', health: 'Health', fun: 'Entertainment', sal: 'Salary', bonus: 'Bonus', other: 'Other' };
  const n = JA
    ? { lunch: 'ランチ', groc: 'スーパー', coffee: 'コーヒー', suica: 'Suicaチャージ', elec: '電気代', phone: 'スマホ代', uniqlo: 'ユニクロ', books: '本', movie: '映画', karaoke: 'カラオケ', pharm: '薬局', dinner: '友だちと夕食', sneakers: 'スニーカー', rent: '家賃', salary: '給料', gas: 'ガス代' }
    : { lunch: 'Lunch', groc: 'Groceries', coffee: 'Coffee', suica: 'Suica top-up', elec: 'Electricity', phone: 'Phone', uniqlo: 'Uniqlo', books: 'Books', movie: 'Movie', karaoke: 'Karaoke', pharm: 'Pharmacy', dinner: 'Dinner with friends', sneakers: 'Sneakers', rent: 'Rent', salary: 'Salary', gas: 'Gas' };
  const entries = [];
  let i = 0;
  const add = (m, day, type, amount, category, note, hour = 3) =>
    entries.push({
      id: `mk-${i++}`,
      timestamp: `2026-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00.000Z`,
      y: 2026, m, day, type, amount, category, note, repeat: 'never',
    });
  const lunches = [780, 920, 850, 1050, 680, 890, 760];
  const grocs = [4280, 5640, 3920, 6180, 4870];
  let li = 0, gi = 0;
  for (const m of [7, 8, 9]) {
    const last = m === 9 ? 20 : new Date(2026, m + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const wd = new Date(2026, m, d).getDay();
      if (wd >= 1 && wd <= 5 && (d + m) % 4 !== 0) add(m, d, 'expense', lunches[li++ % lunches.length], c.food, n.lunch);
      if (wd === 3 && d % 2 === 1) add(m, d, 'expense', 480, c.food, n.coffee, 1);
      if (wd === 6) add(m, d, 'expense', grocs[gi++ % grocs.length], c.food, n.groc, 6);
    }
    add(m, 1, 'expense', 1490, c.fun, 'Netflix', 11);
    add(m, 5, 'expense', 3000, c.tr, n.suica, 0);
    add(m, 19, 'expense', 3000, c.tr, n.suica, 0);
    add(m, 10, 'expense', m === 7 ? 9620 : m === 8 ? 8140 : 6980, c.util, n.elec, 9);
  }
  add(7, 12, 'expense', 5990, c.shop, n.uniqlo, 7);
  add(7, 23, 'expense', 1900, c.fun, n.movie, 9);
  add(8, 8, 'expense', 1280, c.health, n.pharm, 8);
  add(8, 13, 'expense', 2500, c.fun, n.karaoke, 11);
  add(8, 21, 'expense', 2400, c.shop, n.books, 5);
  add(9, 3, 'expense', 1900, c.fun, n.movie, 9);
  // Sat 17 Oct: the notable day for the Calendar day note.
  add(9, 17, 'expense', 6400, c.food, n.dinner, 11);
  add(9, 17, 'expense', 8900, c.shop, n.sneakers, 5);
  const rule = (id, day, type, amount, category, note) => ({
    id, timestamp: '2026-01-01T03:00:00.000Z', start: { y: 2026, m: 0, day }, anchorDay: day,
    type, amount, category, note, repeat: 'monthly', weekendShift: 'off', exceptions: [],
  });
  const expCats = JA
    ? [c.food, c.rent, c.tr, c.shop, c.util, c.phone, c.health, c.fun]
    : [c.food, c.rent, c.tr, c.shop, c.util, c.health, c.fun];
  return {
    version: 1,
    state: {
      theme: 'system',
      expCats,
      incCats: [c.sal, c.bonus, c.other],
      entries,
      recurrenceRules: [
        rule('rent', 27, 'expense', 85000, c.rent, n.rent),
        rule('salary', 25, 'income', 340000, c.sal, n.salary),
        ...(JA ? [] : [rule('phone', 15, 'expense', 2980, c.phone, n.phone)]),
      ],
      budgets: {},
      budgetMode: 'total',
      totalBudget: 180000,
      calendarView: 'dots',
      ...(SHOT === 'summary' ? { ai: { nudgesEnabled: false, spotlightEnabled: true, letters: {}, nudge: null } } : {}),
    },
  };
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 440, height: 956 },
  deviceScaleFactor: 3,
  locale: T.locale,
  colorScheme: process.env.DARK ? 'dark' : 'light',
  reducedMotion: 'no-preference',
});
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept());
await page.clock.install({ time: TODAY });
const blob = JSON.stringify(seed());
await page.addInitScript((value) => {
  if (!sessionStorage.getItem('seeded')) {
    localStorage.setItem('kaji:state:v1', value);
    sessionStorage.setItem('seeded', '1');
  }
}, blob);
await page.goto(`${BASE}/?ai=fake`);
await page.getByTestId('loading-screen').waitFor({ state: 'hidden', timeout: 30000 });
await page.getByTestId('tab-bar').waitFor();
await page.waitForTimeout(800);

// De-frame: drop the desktop phone card, open a top gap for the status bar.
await page.evaluate((top) => {
  for (const el of document.querySelectorAll('div')) {
    const cs = getComputedStyle(el);
    if (cs.maxWidth === '402px' && cs.borderTopLeftRadius === '32px') {
      const s = (k, v) => el.style.setProperty(k, v, 'important');
      s('max-width', 'none'); s('border-radius', '0'); s('border-width', '0'); s('box-shadow', 'none');
      s('padding-top', `${top}px`);
      el.parentElement.style.setProperty('padding', '0', 'important');
      el.dataset.mkPhone = '1';
    }
  }
}, TOP);
await page.waitForTimeout(500);

async function visibleDay(d) {
  for (const cell of await page.getByLabel(T.day(d), { exact: true }).all()) {
    const b = await cell.boundingBox();
    if (b && b.x >= 0 && b.x + b.width <= 441) return cell;
  }
  throw new Error('no day ' + d);
}
const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${LANG}-${name}.png` });
  console.log('saved', `${OUT}/${LANG}-${name}.png`);
};

if (SHOT === 'probe') {
  await shot('probe');
} else if (SHOT === 'entry') {
  await page.getByLabel(T.addEntry, { exact: true }).click();
  await page.getByTestId('entry-sheet').waitFor();
  await page.waitForTimeout(800);
  await page.getByLabel(T.line, { exact: true }).fill(T.text);
  await page.getByTestId('ai-entry-filled').waitFor({ timeout: 5000 });
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.waitForTimeout(1200);
  await shot('1-entry');
} else if (SHOT === 'voice') {
  const orb = page.locator('[data-testid="ai-orb"]:visible').first();
  const c = await orb.boundingBox();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  await page.mouse.down();
  const bubble = page.getByTestId('ai-orb-bubble');
  await bubble.waitFor({ timeout: 3000 });
  await page.waitForFunction((t) => document.querySelector('[data-testid="ai-orb-bubble"]')?.textContent === t, JA ? '昨日ランチ 850円' : 'lunch 850 yesterday', { timeout: 4000 });
  await page.waitForTimeout(200);
  await shot('2-voice');
} else if (SHOT === 'calendar') {
  await (await visibleDay(17)).click();
  await page.getByTestId('ai-day-note').waitFor({ timeout: 5000 });
  await page.getByTestId('ai-repeat').waitFor({ timeout: 5000 });
  await page.getByTestId('ai-forecast').waitFor({ timeout: 5000 });
  await page.waitForTimeout(1500);
  await shot('3-calendar');
} else if (SHOT === 'receipt') {
  await page.getByLabel(T.addEntry, { exact: true }).click();
  await page.getByTestId('entry-sheet').waitFor();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: T.scan, exact: true }).click();
  await page.getByTestId('ai-entry-filled').waitFor({ timeout: 5000 });
  await page.waitForTimeout(1200);
  await shot('4-receipt');
} else if (SHOT === 'letter') {
  await page.getByRole('tab', { name: T.summary, exact: true }).click();
  await page.getByTestId('ai-letter').waitFor({ timeout: 8000 }).catch(() => console.log('no letter'));
  await page.waitForTimeout(2000);
  await shot('5-letter');
} else if (SHOT === 'ask') {
  await page.getByRole('tab', { name: T.summary, exact: true }).click();
  await page.waitForTimeout(1500);
  await page.getByTestId('ask-pill').click();
  await page.getByTestId('ask-sheet').waitFor();
  await page.waitForTimeout(800);
  const q = JA ? '今月いくら使った？' : 'How much did I spend this month?';
  await page.getByTestId('ask-sheet').getByLabel(q, { exact: true }).click();
  await page.getByTestId('ask-answer').waitFor();
  await page.waitForTimeout(1500);
  await shot('5-ask');
} else if (SHOT === 'summary') {
  await page.getByRole('tab', { name: T.summary, exact: true }).click();
  await page.waitForTimeout(1500);
  for (const id of ['ai-letter', 'ai-nudge']) {
    const hide = page.getByTestId(id);
    if (await hide.count()) console.log(id, 'present');
  }
  await shot('6-summary');
}
await browser.close();
