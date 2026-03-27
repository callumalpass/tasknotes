/**
 * Static file server + file watcher for docs-builder/dist.
 * Replaces `python3 -m http.server` so the dev script works on
 * both Windows (PowerShell) and Linux/macOS/WSL without Python.
 *
 * Watches docs/ and docs-builder/src/ for changes and rebuilds
 * automatically. Refresh the browser to see updates.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dir, 'dist');
const DOCS = path.resolve(__dir, '../docs');
const SRC  = path.resolve(__dir, 'src');
const PORT = Number(process.env.PORT) || 4321;

// ── Static file server ─────────────────────────────────────────────

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(DIST, urlPath);

  // Directory → try index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
});

// ── File watcher + rebuild ──────────────────────────────────────────

let buildTimer = null;
let building = false;

function rebuild() {
  if (building) {
    // Queue another build after the current one finishes
    buildTimer = setTimeout(rebuild, 300);
    return;
  }
  building = true;
  const start = Date.now();
  process.stdout.write('Rebuilding... ');

  execFile('node', ['build.js'], { cwd: __dir }, (err, stdout, stderr) => {
    building = false;
    if (err) {
      console.error('BUILD FAILED');
      if (stderr) console.error(stderr);
    } else {
      console.log(stdout.trim() || `done (${Date.now() - start}ms)`);
    }
  });
}

function scheduleRebuild(filename) {
  clearTimeout(buildTimer);
  buildTimer = setTimeout(() => {
    console.log(`\nChange detected: ${filename || 'unknown file'}`);
    rebuild();
  }, 300);
}

function watchDir(dir, label) {
  try {
    fs.watch(dir, { recursive: true }, (_event, filename) => {
      // Ignore hidden files and dist output
      if (filename && (filename.startsWith('.') || filename.includes('node_modules'))) return;
      scheduleRebuild(`${label}/${filename || ''}`);
    });
    console.log(`  Watching ${label}/`);
  } catch (e) {
    console.warn(`  Could not watch ${label}/: ${e.message}`);
  }
}

// ── Start ───────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`Serving docs at http://127.0.0.1:${PORT}/`);
  watchDir(DOCS, 'docs');
  watchDir(SRC, 'docs-builder/src');
  console.log('Refresh browser after changes. Press Ctrl+C to stop.\n');
});
