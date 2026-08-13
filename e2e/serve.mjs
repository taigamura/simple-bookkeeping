/**
 * Static server for the exported Expo web build (e2e/.web-build), used as
 * Playwright's webServer. Zero dependencies on purpose: the e2e pipeline must
 * not grow paid services or heavyweight tooling (#57/#58). SPA fallback sends
 * unknown paths to index.html, matching how the app is hosted.
 *
 * Run `npm run e2e:export` first; this refuses to serve a missing build so a
 * stale-or-absent export fails loudly instead of green-running old code.
 */
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('./.web-build', import.meta.url));
const PORT = Number(process.env.E2E_PORT ?? 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error(
    `No web build at ${ROOT} — run \`npm run e2e:export\` first (or \`npm run e2e\`, which does both).`,
  );
  process.exit(1);
}

const server = createServer(async (req, res) => {
  // Strip the query string and resolve inside ROOT only (no path traversal).
  const urlPath = decodeURIComponent(new URL(req.url, 'http://e2e').pathname);
  const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(ROOT, safePath);

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, 'index.html');
    await stat(filePath);
  } catch {
    filePath = join(ROOT, 'index.html'); // SPA fallback
  }

  res.writeHead(200, {
    'content-type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`kaji e2e web build on http://localhost:${PORT}`);
});
