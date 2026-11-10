import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PORT = 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.csv': 'text/csv; charset=utf-8'
};

export function fileUrl() {
  return pathToFileURL(path.join(ROOT, 'index.html')).href;
}

export function serve(port = PORT) {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file;
    if (rel.startsWith('/__fonts/')) file = path.join(ROOT, 'node_modules', rel.slice('/__fonts/'.length));
    else file = path.join(ROOT, rel === '/' ? 'index.html' : rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await serve();
  console.log('http://127.0.0.1:' + PORT + '/index.html');
}
