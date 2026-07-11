/**
 * Firefox runner for the sheet-regression suite (#58) — the no-sudo escape
 * hatch for machines where Playwright Chromium's system libraries can't be
 * installed (e.g. bare WSL2: `libasound.so.2` missing and no root to apt-get
 * it). Chromium in CI stays the canonical browser; this exists so the suite
 * is still runnable locally on such machines.
 *
 * Playwright's Firefox links ALSA's MIDI-sequencer API directly into libxul
 * (Web MIDI), so with no system libasound XPCOMGlueLoad aborts at startup —
 * and an *empty* stub library is not enough, because the dynamic linker
 * resolves each versioned symbol (`snd_seq_*@ALSA_0.9`), not just the file.
 * Headless test runs never touch MIDI, so this script generates a real stub:
 * it reads the versioned ALSA imports out of the installed Firefox's own
 * libxul.so (objdump -T), emits one error-returning function per symbol plus
 * a matching version script, compiles it into e2e/.alsa-stub/libasound.so.2
 * (gitignored, rebuilt when the Firefox build changes), and exposes it via
 * LD_LIBRARY_PATH. It also sets PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS,
 * because Playwright's pre-launch host validation would reject the machine
 * before launch.
 *
 * Usage: `npm run e2e:test:firefox [-- <playwright test args>]`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { firefox } from '@playwright/test';

const STUB_DIR = fileURLToPath(new URL('./.alsa-stub', import.meta.url));
const STUB = join(STUB_DIR, 'libasound.so.2');
const STAMP = join(STUB_DIR, '.stamp');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function systemHasLibasound() {
  const probe = spawnSync('ldconfig', ['-p'], { encoding: 'utf8' });
  return probe.status === 0 && probe.stdout.includes('libasound.so.2');
}

/** Versioned ALSA imports of the installed Firefox's libxul, as version → [symbol]. */
function alsaImportsOf(libxul) {
  const dump = spawnSync('objdump', ['-T', libxul], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (dump.status !== 0) {
    fail(`objdump -T ${libxul} failed (is binutils installed?):\n${dump.stderr || dump.error}`);
  }
  const byVersion = new Map();
  for (const line of dump.stdout.split('\n')) {
    if (!line.includes('*UND*')) continue;
    const m = line.match(/\(?(ALSA_[0-9A-Za-z.]+)\)?\s+(\S+)\s*$/);
    if (!m) continue;
    const [, version, symbol] = m;
    if (!byVersion.has(version)) byVersion.set(version, []);
    byVersion.get(version).push(symbol);
  }
  return byVersion;
}

function buildStub(libxul) {
  const imports = alsaImportsOf(libxul);
  if (imports.size === 0) {
    fail(`no versioned ALSA imports found in ${libxul} — stub approach no longer applies`);
  }
  const symbols = [...imports.values()].flat();
  // Every stub returns -1: ALSA's error convention, so if anything ever does
  // call in (it shouldn't — headless runs never use Web MIDI), Firefox takes
  // its normal no-MIDI error path instead of crashing.
  const c = symbols.map((s) => `int ${s}(void) { return -1; }`).join('\n') + '\n';
  const versionScript =
    [...imports.entries()]
      .map(([version, syms]) => `${version} {\n global:\n  ${syms.join(';\n  ')};\n};`)
      .join('\n') + '\n';

  mkdirSync(STUB_DIR, { recursive: true });
  const cFile = join(STUB_DIR, 'stub.c');
  const mapFile = join(STUB_DIR, 'stub.map');
  writeFileSync(cFile, c);
  writeFileSync(mapFile, versionScript);
  const cc = spawnSync(
    'cc',
    [
      '-shared',
      '-fPIC',
      cFile,
      '-Wl,-soname,libasound.so.2',
      `-Wl,--version-script=${mapFile}`,
      '-o',
      STUB,
    ],
    { stdio: 'inherit' },
  );
  if (cc.status !== 0) {
    fail(
      'System has no libasound.so.2 and the stub build failed (is a C compiler installed?). ' +
        'Install libasound2 (sudo apt-get install libasound2t64) or a C compiler, then retry.',
    );
  }
}

const env = {
  ...process.env,
  E2E_BROWSER: 'firefox',
  PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS: 'true',
};

if (!systemHasLibasound()) {
  const libxul = join(dirname(firefox.executablePath()), 'libxul.so');
  if (!existsSync(libxul)) {
    fail(
      `libxul.so not found next to ${firefox.executablePath()} — install with: npm run e2e:install -- firefox`,
    );
  }
  // The stub is keyed to the exact Firefox build: rebuild when it changes.
  const stamp = `${libxul}:${statSync(libxul).mtimeMs}`;
  const current = existsSync(STAMP) ? readFileSync(STAMP, 'utf8') : '';
  if (!existsSync(STUB) || current !== stamp) {
    buildStub(libxul);
    writeFileSync(STAMP, stamp);
  }
  // Real system libs are absent, so shadowing is not a concern here.
  env.LD_LIBRARY_PATH = env.LD_LIBRARY_PATH ? `${STUB_DIR}:${env.LD_LIBRARY_PATH}` : STUB_DIR;
}

const result = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});
process.exit(result.status ?? 1);
