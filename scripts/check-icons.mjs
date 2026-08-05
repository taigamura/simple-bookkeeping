/**
 * Guards the native iOS appearance-aware icon configuration and its assets.
 *
 * Run after changing app.json or the icon generator:
 *
 *   npm run icons:check
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(join(ROOT, 'app.json'), 'utf8'));
const expectedIcons = {
  light: './assets/icon.png',
  dark: './assets/icon-dark.png',
};

assert.deepEqual(
  config.expo?.ios?.icon,
  expectedIcons,
  'app.json must declare native iOS light and dark home-screen icons',
);

const buffers = new Map();

for (const [appearance, relativePath] of Object.entries(expectedIcons)) {
  const absolutePath = join(ROOT, relativePath);
  const buffer = await readFile(absolutePath);
  const metadata = await sharp(buffer).metadata();

  assert.equal(metadata.format, 'png', `${appearance} iOS icon must be a PNG`);
  assert.equal(metadata.width, 1024, `${appearance} iOS icon must be 1024 px wide`);
  assert.equal(metadata.height, 1024, `${appearance} iOS icon must be 1024 px tall`);
  assert.equal(metadata.hasAlpha, false, `${appearance} iOS icon must be fully opaque`);
  buffers.set(appearance, buffer);
}

assert.notDeepEqual(
  buffers.get('light'),
  buffers.get('dark'),
  'light and dark iOS icons must be visually distinct assets',
);

console.log('iOS light/dark icon configuration and assets are valid.');
