import { firefox } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const SC = '/tmp/claude-1000/-home-taigamura-dev-simple-bookkeeping/3f582bcc-e31c-42d0-94aa-c891ae778da2/scratchpad';
const HOST = 'http://127.0.0.1:8791';
const TPL = readFileSync(`${SC}/panel-template.html`, 'utf8');

const FONT_EN = "'Liberation Sans','Helvetica Neue',Arial,sans-serif";
const FONT_JP = "'Meiryo','Meiryo UI','Liberation Sans',sans-serif";

// [screenBasename, headlineHTML, sublineHTML]
const COPY = {
  en: [
    ['en-1-calendar',      `Your month's<br><span class="hl">balance</span> at a glance`, `Income and spending, logged by day`],
    ['en-2-summary',       `See <span class="hl">where</span><br>your money goes`,        `In and out`],
    ['en-3-entry',         `<span class="hl">Logged</span><br>in seconds`,                `Amount and category. Calculator included.`],
    ['en-4-settings',      `<span class="hl">Customize</span> it<br>to you`,              `Categories, currency, and theme`],
    ['en-5-calendar-dark', `Easy on the eyes,<br><span class="hl">day or night</span>`,    `A calm dark mode`],
  ],
  jp: [
    ['jp-1-calendar',      `一目で月の<br><span class="hl">収支</span>を確認`,   `収支は、その日ごとに記録`],
    ['jp-2-summary',       `お金の<span class="hl">行き先</span><br>を確認`,     `出納`],
    ['jp-3-entry',         `<span class="hl">数秒</span>で記録`,                  `金額とカテゴリだけ、電卓付き`],
    ['jp-4-settings',      `あなたに合わせて<br><span class="hl">カスタム</span>`, `カテゴリも、通貨も、テーマも`],
    ['jp-5-calendar-dark', `夜も<span class="hl">目に優しく</span>`,              `静かなダークモード対応`],
  ],
};

const SIZES = { '6.9': [1320, 2868], '6.7': [1284, 2778] };

const browser = await firefox.launch();
let count = 0;
for (const [sizeName, [W, H]] of Object.entries(SIZES)) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const lang of ['en', 'jp']) {
    const font = lang === 'jp' ? FONT_JP : FONT_EN;
    const outDir = `${SC}/out/appstore/${sizeName}/${lang}`;
    mkdirSync(outDir, { recursive: true });
    for (const [base, hl, sub] of COPY[lang]) {
      const screenUrl = `${HOST}${SC}/src/${sizeName}/${base}.png`;
      const html = TPL.replace('__FONT__', font).replace('__HL__', hl)
        .replace('__SUB__', sub).replace('__SCREEN__', screenUrl);
      const htmlPath = `${SC}/_panel_${sizeName}_${base}.html`; // unique URL avoids HTTP cache reuse
      writeFileSync(htmlPath, html);
      await page.goto(`${HOST}${htmlPath}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const i = document.querySelector('img');
        return i && i.complete && i.naturalWidth > 0;
      }, { timeout: 15000 });
      await page.waitForTimeout(250);
      const out = `${outDir}/${base}.png`;
      await page.screenshot({ path: out });
      count++;
      console.log('rendered', sizeName, out.split('/').slice(-1)[0]);
    }
  }
  await ctx.close();
}
await browser.close();
console.log('DONE', count, 'panels');
