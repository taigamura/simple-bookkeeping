import assert from 'node:assert/strict';
import { scanSource } from './check-privacy-boundary.mjs';

function expectClean(file, source, kind) {
  assert.deepEqual(scanSource({ file, source, kind }), [], `${file} should be allowed`);
}

function expectViolation(file, source, kind, expected) {
  assert.ok(
    scanSource({ file, source, kind }).some((violation) => violation.includes(expected)),
    `${file} should report ${expected}`,
  );
}

// Bounded local transports remain permitted only at their named native seams.
expectClean(
  'modules/kaji-nearby/ios/KajiNearbyModule.swift',
  'import MultipeerConnectivity\nlet session: MCSession',
  'native',
);
expectClean('config/withWatchExpense.js', 'import WatchConnectivity\nWCSession.default.activate()', 'native');
expectViolation('modules/other/ios/Unexpected.swift', 'import WatchConnectivity', 'native', 'unapproved native watch');
expectViolation('config/withQuickEntry.js', 'import MultipeerConnectivity', 'native', 'unapproved native multipeer');

// Both checked-in Swift and Swift embedded in config plugins must reject public
// network and telemetry capabilities.
expectViolation('modules/other/ios/Unexpected.swift', 'URLSession.shared.dataTask(with: request)', 'native', 'URLSession');
expectViolation('config/withQuickEntry.js', 'let url = URL(string: "https://example.com")', 'native', 'public URL');
expectViolation('config/withQuickEntry.js', 'SentrySDK.start()', 'native', 'telemetry SDK');

console.log('Privacy boundary regression coverage passed.');
