/**
 * Brightloop Software — Standalone Frontend Server
 * Zero-dependency static & SPA file server for running frontend independently.
 * Default port: 5500 (or FRONTEND_PORT env var).
 *
 * Run with: node frontend/server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.FRONTEND_PORT || 5500;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  // Parse URL removing query parameters and hash
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = parsedUrl.pathname;

  // Normalize any nested relative asset requests (e.g. /dashboard/admin/js/... -> /js/...)
  if (pathname.includes('/js/')) {
    pathname = pathname.substring(pathname.indexOf('/js/'));
  } else if (pathname.includes('/css/')) {
    pathname = pathname.substring(pathname.indexOf('/css/'));
  }

  // Normalize path and prevent directory traversal
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '') safePath = '/index.html';

  let filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      // If it's a specific asset with an extension that does not exist, return 404
      if (path.extname(pathname)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('404 File Not Found');
      }

      // SPA Fallback: Serve index.html for client-side routing
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(content);
        }
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n💻 ═══════════════════════════════════════════════════════════════`);
  console.log(`   Brightloop Frontend Server running at http://localhost:${PORT}`);
  console.log(`   📡 Connected to Backend API at http://localhost:3000`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);
});

module.exports = server;
