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
const NATIVE_LOCAL_TRANSPORT_CAPABILITIES = new Map([
  ['modules/kaji-nearby/ios/KajiNearbyModule.swift', new Set(['multipeer'])],
  // This config plugin embeds the Watch extension and iPhone bridge as Swift.
  ['config/withWatchExpense.js', new Set(['watch'])],
]);
const APP_DIRECTORIES = ['domain', 'i18n', 'nav', 'platform', 'screens', 'store', 'theme', 'ui'];
const APP_FILES = ['App.tsx', 'index.ts'];
const CONFIG_FILES = ['package.json', 'package-lock.json', 'app.json', 'app.config.js', 'eas.json', 'babel.config.js'];
const CONFIG_PLUGIN_DIRECTORY = 'config';
const NATIVE_MODULE_DIRECTORY = 'modules';

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

// No native HTTP, WebSocket, generic socket, or telemetry client is permitted.
// The only native communication APIs allowed in this repository are explicitly
// scoped MultipeerConnectivity and WatchConnectivity references above.
const FORBIDDEN_NATIVE_CAPABILITIES = [
  ['public URL', /https?:\/\//i],
  ['URLSession', /\b(?:NS)?URLSession\b/],
  ['URLRequest', /\b(?:NSMutable)?URLRequest\b/],
  ['URL connection', /\bNSURLConnection\b/],
  ['WebSocket', /\b(?:URLSessionWebSocketTask|WebSocket)\b/],
  ['generic Network framework', /\b(?:import\s+Network|NWConnection|NWListener|NWBrowser)\b/],
  ['raw socket', /\b(?:CFSocket|GCDAsyncSocket|socket)\s*\(/],
  ['telemetry SDK', /\b(?:Sentry(?:SDK)?|Firebase(?:App|Analytics)?|Crashlytics|Datadog|Mixpanel|Amplitude|Segment|PostHog|Telemetry|Analytics)\b/i],
];
const LOCAL_TRANSPORT_CAPABILITIES = [
  ['multipeer', /\b(?:import\s+MultipeerConnectivity|MCSession|MCPeerID|MCNearbyService(?:Advertiser|Browser))\b/],
  ['watch', /\b(?:import\s+WatchConnectivity|WCSession)\b/],
];

async function filesUnder(path, projectRoot = root, extensionPattern = /\.(?:js|jsx|ts|tsx|json)$/) {
  const entries = await readdir(join(projectRoot, path), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(child, projectRoot, extensionPattern)));
    else if (extensionPattern.test(entry.name)) files.push(child);
  }
  return files;
}

export function scanSource({ file, source, kind }) {
  const violations = [];
  if (kind === 'app' && !ALLOWED_NEARBY_TRANSPORT_FILES.has(file)) {
    for (const pattern of [...FORBIDDEN_IMPORTS, ...FORBIDDEN_APIS]) {
      if (pattern.test(source)) violations.push(`${file}: ${pattern}`);
    }
  }

  if (kind === 'config') {
    for (const pattern of FORBIDDEN_CONFIG) {
      if (pattern.test(source)) violations.push(`${file}: ${pattern}`);
    }
  }

  if (kind === 'native') {
    for (const [capability, pattern] of FORBIDDEN_NATIVE_CAPABILITIES) {
      if (pattern.test(source)) violations.push(`${file}: forbidden native ${capability}`);
    }

    const allowedCapabilities = NATIVE_LOCAL_TRANSPORT_CAPABILITIES.get(file) ?? new Set();
    for (const [capability, pattern] of LOCAL_TRANSPORT_CAPABILITIES) {
      if (pattern.test(source) && !allowedCapabilities.has(capability)) {
        violations.push(`${file}: unapproved native ${capability} transport`);
      }
    }
  }

  return violations;
}

export async function checkPrivacyBoundary(projectRoot = root) {
  const sourceFiles = [...APP_FILES, ...(await Promise.all(APP_DIRECTORIES.map((path) => filesUnder(path, projectRoot)))).flat()];
  const configPluginFiles = await filesUnder(CONFIG_PLUGIN_DIRECTORY, projectRoot);
  const nativeModuleFiles = await filesUnder(NATIVE_MODULE_DIRECTORY, projectRoot, /\.swift$/);
  const configFiles = [...CONFIG_FILES, ...configPluginFiles];
  const violations = [];

  for (const file of sourceFiles) {
    violations.push(...scanSource({ file, source: await readFile(join(projectRoot, file), 'utf8'), kind: 'app' }));
  }
  for (const file of configFiles) {
    violations.push(...scanSource({ file, source: await readFile(join(projectRoot, file), 'utf8'), kind: 'config' }));
  }
  for (const file of [...nativeModuleFiles, ...configPluginFiles]) {
    violations.push(...scanSource({ file, source: await readFile(join(projectRoot, file), 'utf8'), kind: 'native' }));
  }

  return { violations, sourceFiles, configFiles, nativeModuleFiles, configPluginFiles };
}

async function main() {
  const { violations, sourceFiles, configFiles, nativeModuleFiles, configPluginFiles } = await checkPrivacyBoundary();
  if (violations.length > 0) {
    console.error('Privacy boundary violation(s):');
    for (const violation of violations) console.error(`- ${violation}`);
    process.exit(1);
  }

  console.log(
    `Privacy boundary passed: ${sourceFiles.length} app source files, ${configFiles.length} config files, ` +
      `${nativeModuleFiles.length} Swift modules, and ${configPluginFiles.length} config plugins checked; ` +
      `nearby transport allowlist: ${[...ALLOWED_NEARBY_TRANSPORT_FILES].join(', ')}; ` +
      `native local transport allowlist: ${[...NATIVE_LOCAL_TRANSPORT_CAPABILITIES.keys()].join(', ')}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
