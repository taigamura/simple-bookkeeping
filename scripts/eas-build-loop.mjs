#!/usr/bin/env node
// One EAS build iteration: submit -> poll -> extract errors.
//
// This script deliberately does NOT fix anything. Fixing a compile error needs
// judgment, so the outer "build, fix, rebuild" loop is driven by an agent (or a
// human) calling `run` repeatedly. See .claude/skills/eas-build-loop/SKILL.md.
//
// Exit codes:
//   0  build FINISHED (artifact URL on stdout)
//   1  build ERRORED with errors we could extract -> fix them and run again
//   2  stop condition: infra/credentials/quota, unchanged error signature,
//      or poll timeout. Do NOT blindly retry these.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const cmd = args[0] ?? 'run';
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const PLATFORM = flag('platform', 'ios');
const PROFILE = flag('profile', 'production');
const POLL_SECONDS = Number(flag('interval', '20'));
const POLL_LIMIT = Number(flag('timeout-minutes', '40')) * 60 / POLL_SECONDS;
const STATE = join(tmpdir(), `eas-build-loop-${createHash('sha1')
  .update(process.cwd()).digest('hex').slice(0, 12)}.json`);

const eas = (argv, { json = true } = {}) =>
  execFileSync('npx', ['eas-cli', ...argv], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: json ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

// `build:view` REJECTS --non-interactive (so do `credentials:*`). `build:list`
// accepts it. Everything here goes through build:list and filters by id, because
// a bare `build:view` in a non-tty can block waiting on a prompt.
const fetchBuild = (id) => {
  const out = eas(['build:list', '--platform', PLATFORM, '--limit', '30',
    '--json', '--non-interactive']);
  const list = JSON.parse(out);
  return id ? list.find((b) => b.id === id) : list[0];
};

const submit = () => {
  const out = eas(['build', '--platform', PLATFORM, '--profile', PROFILE,
    '--non-interactive', '--no-wait', '--json']);
  const parsed = JSON.parse(out);
  return (Array.isArray(parsed) ? parsed[0] : parsed).id;
};

const sleep = (s) => execFileSync('sleep', [String(s)]);

const poll = (id) => {
  for (let i = 0; i < POLL_LIMIT; i++) {
    const b = fetchBuild(id);
    if (b && ['FINISHED', 'ERRORED', 'CANCELED'].includes(b.status)) return b;
    sleep(POLL_SECONDS);
  }
  return null;
};

// EAS log files are brotli-encoded but served as text/plain. A plain GET yields
// binary garbage -- curl --compressed (or an explicit br decode) is required.
const fetchLog = (url) => {
  try {
    return execFileSync('curl', ['-s', '--compressed', '--max-time', '120', url],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  } catch {
    return '';
  }
};

const ERROR_RE = /(?:^|\s)(?:error:|fatal error:|\*\* ARCHIVE FAILED \*\*|\*\* BUILD FAILED \*\*)/;

const extractErrors = (build) => {
  const seen = new Set();
  for (const url of build.logFiles ?? []) {
    for (let line of fetchLog(url).split('\n')) {
      // Worker logs arrive as bunyan JSON; the payload is in .msg
      if (line.startsWith('{') && line.includes('"msg"')) {
        try { line = JSON.parse(line).msg ?? line; } catch { /* keep raw */ }
      }
      line = line.trim();
      if (line && ERROR_RE.test(line)) seen.add(line.slice(0, 400));
    }
  }
  return [...seen];
};

// Not every red build is a code bug. Retrying these just burns quota and
// autoIncrement build numbers, so they exit 2 instead of 1.
const STOP_PATTERNS = [
  /quota|billing|limit reached|exceeded|plan does not/i,
  /credential|provisioning profile|certificate|expired|apple id|authentication/i,
  /internal error|infrastructure|try again later|capacity/i,
];

const classify = (build, errors) => {
  const msg = build.error?.message ?? '';
  if (STOP_PATTERNS.some((re) => re.test(msg))) return 'stop';
  if (errors.length === 0) return 'stop'; // nothing actionable extracted
  return 'code';
};

const signature = (errors) =>
  createHash('sha1').update(errors.slice().sort().join('\n')).digest('hex');

const report = (build, errors) => {
  console.log(`build   ${build.id}`);
  console.log(`status  ${build.status}  v${build.appBuildVersion}`);
  console.log(`url     https://expo.dev/accounts/${build.project?.ownerAccount?.name}` +
    `/projects/${build.project?.slug}/builds/${build.id}`);
  if (build.error?.message) console.log(`message ${build.error.message}`);
  if (errors.length) {
    console.log(`\n=== ${errors.length} error line(s) ===`);
    for (const e of errors) console.log(e);
  }
};

if (cmd === 'errors') {
  const build = fetchBuild(args[1]);
  if (!build) { console.error('build not found'); process.exit(2); }
  report(build, extractErrors(build));
  process.exit(0);
}

if (cmd === 'run') {
  const id = args[1] ?? submit();
  console.log(`# ${args[1] ? 'watching' : 'submitted'} ${id} (${PLATFORM}/${PROFILE})`);
  const build = poll(id);

  if (!build) {
    console.error(`TIMEOUT after ${POLL_LIMIT * POLL_SECONDS / 60}min — check ${id} manually.`);
    process.exit(2);
  }

  if (build.status === 'FINISHED') {
    console.log(`status  FINISHED  v${build.appBuildVersion}`);
    console.log(`ipa     ${build.artifacts?.buildUrl ?? '(none)'}`);
    if (existsSync(STATE)) writeFileSync(STATE, '{}');
    process.exit(0);
  }

  const errors = extractErrors(build);
  report(build, errors);
  const kind = classify(build, errors);

  if (kind === 'stop') {
    console.error('\nSTOP: not a fixable compile error (infra/credentials/quota, ' +
      'or no errors extracted). Do not retry blindly — read the build URL above.');
    process.exit(2);
  }

  const sig = signature(errors);
  const prev = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
  writeFileSync(STATE, JSON.stringify({ sig, id: build.id }));
  if (prev.sig === sig) {
    console.error('\nSTOP: identical error signature to the previous iteration — ' +
      'the last fix did not take. Re-read the code before rebuilding.');
    process.exit(2);
  }

  console.error('\nFixable errors above. Fix them, then run this script again.');
  process.exit(1);
}

console.error(`usage:
  node scripts/eas-build-loop.mjs run [buildId] [--platform ios] [--profile production]
  node scripts/eas-build-loop.mjs errors <buildId>`);
process.exit(2);
