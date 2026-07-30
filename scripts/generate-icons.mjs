/**
 * Regenerates every raster in `assets/` from the Kippu mark.
 *
 *   npm run icons
 *
 * The mark itself lives in `assets/brand/kippu-mark.svg`; the geometry is
 * duplicated below only so this script can recolour and rescale it per target
 * (Android's monochrome layer needs a flat silhouette, the dark splash needs
 * the lifted blue, and each output centres the mark differently). Keep the two
 * in sync — the SVG is the human-readable source, this is the build recipe.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'assets');

// Kept in step with theme/tokens.ts.
const BLUE = '#2B33E8'; // light-mode accent
const DEEP = '#1E2499'; // light-mode hero / the mark's second bar
const BLUE_DARK = '#6B72FF'; // dark-mode accent
const DEEP_DARK = '#3A42D8';
const TILE = '#FFFFFF';
const GROUND_LIGHT = '#F2F2F0';
const GROUND_DARK = '#0F0F13';

/** Drawn bounds of the mark inside the 42×42 viewBox. */
const MARK = { x: 6, y: 9, w: 30, h: 23 };

/**
 * An SVG of `size`², with the mark centred and scaled so its widest dimension
 * covers `fraction` of the canvas.
 *
 * @param {{size:number, fraction:number, bar:string, bar2:string, bg?:string}} opts
 */
function markSvg({ size, fraction, bar, bar2, bg }) {
  const scale = (fraction * size) / MARK.w;
  const dx = (size - MARK.w * scale) / 2 - MARK.x * scale;
  const dy = (size - MARK.h * scale) / 2 - MARK.y * scale;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      (bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : '') +
      `<g transform="translate(${dx} ${dy}) scale(${scale})">` +
      `<rect x="6" y="9" width="30" height="9" rx="4.5" fill="${bar}"/>` +
      `<rect x="6" y="23" width="18" height="9" rx="4.5" fill="${bar2}"/>` +
      `<circle cx="31.5" cy="27.5" r="4.5" fill="${bar}"/>` +
      `</g></svg>`,
  );
}

const png = (svg) => sharp(svg).png();

/** iOS rejects an alpha channel on the store icon, so flatten it onto the tile. */
const opaque = (svg, bg) => png(svg).flatten({ background: bg });

const TARGETS = [
  {
    file: 'icon.png',
    note: 'store / home-screen icon — opaque white tile, system applies the mask',
    build: () =>
      opaque(
        markSvg({ size: 1024, fraction: 0.56, bar: BLUE, bar2: DEEP, bg: TILE }),
        TILE,
      ),
  },
  {
    file: 'favicon.png',
    note: 'web favicon',
    build: () =>
      opaque(markSvg({ size: 48, fraction: 0.68, bar: BLUE, bar2: DEEP, bg: TILE }), TILE),
  },
  {
    file: 'splash-icon.png',
    note: 'light splash — mark on transparent, app.json supplies the ground',
    build: () => png(markSvg({ size: 1024, fraction: 0.8, bar: BLUE, bar2: DEEP })),
  },
  {
    file: 'splash-icon-dark.png',
    note: 'dark splash — lifted blue so it holds against the dark ground',
    build: () =>
      png(markSvg({ size: 1024, fraction: 0.8, bar: BLUE_DARK, bar2: DEEP_DARK })),
  },
  {
    file: 'android-icon-background.png',
    note: 'adaptive background layer — flat tile',
    build: () =>
      png(
        Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="${TILE}"/></svg>`,
        ),
      ),
  },
  {
    file: 'android-icon-foreground.png',
    // Android crops the outer ~33%, so the mark stays well inside the safe zone.
    note: 'adaptive foreground layer — mark sized for the 66% safe zone',
    build: () => png(markSvg({ size: 512, fraction: 0.42, bar: BLUE, bar2: DEEP })),
  },
  {
    file: 'android-icon-monochrome.png',
    note: 'themed-icon layer — flat silhouette, the system tints it',
    build: () =>
      png(markSvg({ size: 432, fraction: 0.42, bar: '#000000', bar2: '#000000' })),
  },
];

await mkdir(ASSETS, { recursive: true });

for (const { file, note, build } of TARGETS) {
  const buffer = await build().toBuffer();
  await writeFile(join(ASSETS, file), buffer);
  const { width, height, channels } = await sharp(buffer).metadata();
  console.log(`  ${file.padEnd(30)} ${width}×${height}  ${channels}ch  — ${note}`);
}

console.log(
  `\nGround colors for app.json: light ${GROUND_LIGHT}, dark ${GROUND_DARK}`,
);
