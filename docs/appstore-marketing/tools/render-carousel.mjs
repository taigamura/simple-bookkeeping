import { firefox } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const SC = '/tmp/claude-1000/-home-taigamura-dev-simple-bookkeeping/3f582bcc-e31c-42d0-94aa-c891ae778da2/scratchpad';
const HOST = 'http://127.0.0.1:8791';
let tpl = readFileSync(`${SC}/carousel.html`, 'utf8');
tpl = tpl.replace('__S1__', `${HOST}${SC}/src/6.9/en-1-calendar.png`)
         .replace('__S2__', `${HOST}${SC}/src/6.9/en-2-summary.png`)
         .replace('__S3__', `${HOST}${SC}/src/6.9/en-3-entry.png`);
const htmlPath = `${SC}/_carousel_render.html`;
writeFileSync(htmlPath, tpl);

const outDir = `${SC}/out/instagram`;
mkdirSync(outDir, { recursive: true });

const browser = await firefox.launch();
const ctx = await browser.newContext({ viewport: { width: 3240, height: 1350 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(`${HOST}${htmlPath}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => {
  const imgs = [...document.querySelectorAll('img')];
  return imgs.length === 3 && imgs.every((i) => i.complete && i.naturalWidth > 0);
}, { timeout: 15000 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/ig-carousel-master.png` });
console.log('master saved');
await browser.close();
