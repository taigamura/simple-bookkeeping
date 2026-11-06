// Config-driven App Store panel renderer.
// Usage: node render-panels.mjs <config.json>
// Renders <size> x <lang> x <panel> PNGs into <outDir>/appstore/<size>/<lang>/.
//
// Requires an HTTP server rooted at / so absolute paths resolve as URLs:
//   cd / && python3 -m http.server 8791 --bind 127.0.0.1 &
// On WSL2 launch with the Firefox ALSA stub (see the project `verify` skill):
//   PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true \
//   LD_LIBRARY_PATH=$REPO/e2e/.alsa-stub node render-panels.mjs config.json
import { createRequire } from 'module';
// Resolve Playwright from the target app repo (PW_ROOT) or cwd, since this
// script may live outside any node_modules tree (e.g. a global skill dir).
const require = createRequire((process.env.PW_ROOT || process.cwd()) + '/');
const { chromium: firefox } = require('@playwright/test');
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const TPL = readFileSync(cfg.panelTemplate, 'utf8');
const HOST = cfg.host;
const TMP = `${cfg.outDir}/_tmp`;
mkdirSync(TMP, { recursive: true });

const browser = await firefox.launch();
let count = 0;
for (const [sizeName, [W, H]] of Object.entries(cfg.sizes)) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  for (const [lang, langCfg] of Object.entries(cfg.langs)) {
    const outDir = `${cfg.outDir}/appstore/${sizeName}/${lang}`;
    mkdirSync(outDir, { recursive: true });
    for (const [base, hl, sub] of langCfg.panels) {
      const screenUrl = `${HOST}${cfg.srcDir}/${sizeName}/${base}.png`;
      const html = TPL
        .replaceAll('__FONT__', langCfg.font)
        .replaceAll('__HL__', hl)
        .replaceAll('__SUB__', sub)
        .replaceAll('__SCREEN__', screenUrl);
      // Unique path per panel: a shared URL makes Firefox serve a cached page
      // and you silently get duplicate panels.
      const htmlPath = `${TMP}/_panel_${sizeName}_${lang}_${base}.html`;
      writeFileSync(htmlPath, html);
      await page.goto(`${HOST}${htmlPath}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const i = document.querySelector('img');
        return i && i.complete && i.naturalWidth > 0;
      }, { timeout: 15000 });
      await page.waitForTimeout(250); // let webfonts settle
      await page.screenshot({ path: `${outDir}/${base}.png` });
      count++;
      console.log('rendered', sizeName, lang, base);
    }
  }
  await ctx.close();
}
await browser.close();
console.log('DONE', count, 'panels');
