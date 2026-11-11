// Serves the built website (dist) on CranL, with Node's own http server and no dependencies.
// index.html, the service worker and the manifest are checked again on every visit, so an update is
// found the next time the app opens; the files in assets/ carry a hash in their name and never change,
// so browsers keep them a year. Run: node tools/serve.ts [folder], on the port in PORT (8080 if none).
import { createReadStream, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Starts serving `root` on `port` (0 picks a free one). Resolves with the server once it listens. */
export function serve(root: string, port: number): Promise<Server> {
  const base = resolve(root);
  const server = createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD' }).end();
      return;
    }
    let path: string;
    try {
      path = decodeURIComponent(new URL(request.url ?? '/', 'http://raqaa').pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    let file = resolve(join(base, path));
    // Nothing outside the folder, whatever the address says.
    if (file !== base && !file.startsWith(base + sep)) file = '';
    let size = -1;
    try {
      if (statSync(file).isDirectory()) file = join(file, 'index.html');
      size = statSync(file).size;
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    response.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'content-length': size,
      'cache-control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).pipe(response);
  });
  return new Promise((ready) => server.listen(port, () => ready(server)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ?? 'dist';
  const port = Number(process.env.PORT ?? 8080);
  serve(root, port).then(() => console.log(`Serving ${root} on port ${port}`));
}
