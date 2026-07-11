/* Temporary (#47 verification): builds a stub libasound.so.2 so
 * chrome-headless-shell can load on this WSL2 box (no sudo for apt).
 * Deleted after the verify run. */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BIN =
  process.env.HOME +
  '/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell';
const OUT = __dirname;

// Bail early if the system already provides libasound.
try {
  const p = execFileSync('ldconfig', ['-p'], { encoding: 'utf8' });
  if (p.includes('libasound.so.2')) {
    console.log('system libasound.so.2 found; no stub needed');
    process.exit(0);
  }
} catch {}

const nm = execFileSync('nm', ['-D', '--undefined-only', BIN], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const syms = [
  ...new Set(
    nm
      .split('\n')
      .map((l) => l.trim().split(/\s+/).pop())
      .filter((s) => s && s.startsWith('snd_')),
  ),
];
console.log(`stubbing ${syms.length} snd_* symbols`);
const src = syms.map((s) => `long ${s}(void) { return -1; }`).join('\n') + '\n';
fs.writeFileSync(path.join(OUT, 'stub.c'), src);
execFileSync('gcc', ['-shared', '-fPIC', '-o', path.join(OUT, 'libasound.so.2'), path.join(OUT, 'stub.c')]);
console.log('built ' + path.join(OUT, 'libasound.so.2'));
