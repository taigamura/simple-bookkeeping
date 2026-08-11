#!/usr/bin/env node

/**
 * Enforce Kaji's app-network boundary at source-control time.
 *
 * Kaji has no public internet service, backend, account, or telemetry path.
 * Authenticated household transfer is local peer networking and is confined to
 * the explicitly named native-nearby boundary below. This is an allowlist, not
 * a blanket exemption for networking elsewhere in the app.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED_NEARBY_TRANSPORT_FILES = new Set(['platform/nearbyNativeTransport.ts']);
const APP_DIRECTORIES = ['domain', 'i18n', 'nav', 'platform', 'screens', 'store', 'theme', 'ui'];
const APP_FILES = ['App.tsx', 'index.ts'];
const CONFIG_FILES = ['package.json', 'package-lock.json', 'app.json', 'eas.json', 'babel.config.js'];

const FORBIDDEN_IMPORTS = [
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]@sentry\//i,
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"][^'"]*\b(?:analytics|amplitude|axios|datadog|firebase|mixpanel|posthog|segment|telemetry)\b/i,
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](?:expo-network|expo-updates|react-native-device-info)['"]/i,
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](?:node-fetch|cross-fetch|whatwg-fetch|undici|got|ky)['"]/i,
];
const FORBIDDEN_APIS = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /navigator\.sendBeacon\s*\(/,
];
const FORBIDDEN_CONFIG = [
  /@sentry\//i,
  /sentry(?:Dsn|AuthToken|Project|Org)?/i,
  /\b(?:analytics|telemetry|crashReporting)\b/i,
  /SENTRY_/i,
];

async function filesUnder(path) {
  const entries = await readdir(join(root, path), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(child)));
    else if (/\.(?:js|jsx|ts|tsx|json)$/.test(entry.name)) files.push(child);
  }
  return files;
}

const sourceFiles = [...APP_FILES, ...(await Promise.all(APP_DIRECTORIES.map(filesUnder))).flat()];
const violations = [];

for (const file of sourceFiles) {
  const source = await readFile(join(root, file), 'utf8');
  const allowedNearbyTransport = ALLOWED_NEARBY_TRANSPORT_FILES.has(file);
  if (allowedNearbyTransport) continue;

  for (const pattern of [...FORBIDDEN_IMPORTS, ...FORBIDDEN_APIS]) {
    if (pattern.test(source)) violations.push(`${file}: ${pattern}`);
  }
}

for (const file of CONFIG_FILES) {
  const source = await readFile(join(root, file), 'utf8');
  for (const pattern of FORBIDDEN_CONFIG) {
    if (pattern.test(source)) violations.push(`${file}: ${pattern}`);
  }
}

if (violations.length > 0) {
  console.error('Privacy boundary violation(s):');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `Privacy boundary passed: ${sourceFiles.length} app source files and ${CONFIG_FILES.length} config files checked; ` +
    `nearby transport allowlist: ${[...ALLOWED_NEARBY_TRANSPORT_FILES].join(', ')}`,
);
