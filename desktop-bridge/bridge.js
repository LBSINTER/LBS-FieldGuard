#!/usr/bin/env node
/**
 * LBS FieldGuard PC Bridge v1.0.6
 *
 * Desktop companion tool that:
 *  1. Accepts PIN-based pairing from the mobile app
 *  2. Receives uploaded PCAP / log bundles over HTTP
 *  3. Verifies SHA-256 integrity of received files
 *  4. Stores files in a local directory
 *  5. Provides a web dashboard for log inspection
 */

'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const readline = require('readline');
const { URL } = require('url');

/* ── Config ── */
const PORT = parseInt(process.env.LBS_PORT || '8473', 10);
const VERSION = '1.0.6';
const DATA_DIR = path.join(os.homedir(), 'LBS-FieldGuard-Logs');

/* ── State ── */
let sessionPin = '';
let paired = false;
const receivedFiles = [];

/* ── Helpers ── */
function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function generatePin() {
  return Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function jsonResponse(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function htmlDashboard() {
  const rows = receivedFiles
    .map(
      (f) =>
        `<tr><td>${f.name}</td><td>${(f.size / 1024).toFixed(1)} KB</td>` +
        `<td style="font-family:monospace;font-size:11px">${f.sha256.slice(0, 16)}...</td>` +
        `<td>${f.ts}</td><td>${f.verified ? 'OK' : 'MISMATCH'}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LBS FieldGuard PC Bridge</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a;padding:24px}
  h1{font-size:20px;font-weight:700;margin-bottom:4px}
  .sub{color:#64748b;font-size:13px;margin-bottom:20px}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:18px;margin-bottom:16px}
  .label{font-size:11px;font-weight:700;color:#64748b;letter-spacing:.6px;text-transform:uppercase}
  .pin{font-size:32px;font-weight:700;color:#2563eb;letter-spacing:8px;margin-top:4px}
  .status{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600}
  .status.paired{background:#dcfce7;color:#16a34a}
  .status.waiting{background:#fef9c3;color:#d97706}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  th{text-align:left;font-size:11px;font-weight:700;color:#64748b;border-bottom:2px solid #e2e8f0;padding:6px 8px}
  td{padding:6px 8px;border-bottom:1px solid #f1f5f9;font-size:12px}
  .empty{color:#94a3b8;font-style:italic;padding:20px 0;text-align:center}
  .foot{margin-top:30px;color:#94a3b8;font-size:11px;text-align:center}
</style>
</head><body>
<h1>LBS FieldGuard PC Bridge</h1>
<p class="sub">Desktop companion v${VERSION} &mdash; listening on port ${PORT}</p>

<div class="card">
  <span class="label">Session PIN</span>
  <div class="pin">${sessionPin}</div>
  <div style="margin-top:6px"><span class="status ${paired ? 'paired' : 'waiting'}">${paired ? 'PAIRED' : 'WAITING'}</span></div>
</div>

<div class="card">
  <span class="label">Received Files (${receivedFiles.length})</span>
  ${
    receivedFiles.length === 0
      ? '<div class="empty">No files received yet. Pair from the mobile app and upload logs.</div>'
      : `<table><tr><th>Name</th><th>Size</th><th>SHA-256</th><th>Time</th><th>Verified</th></tr>${rows}</table>`
  }
</div>

<div class="foot">LBS FieldGuard &copy; 2025 &mdash; lbs-int.com</div>
<script>setTimeout(()=>location.reload(),10000)</script>
</body></html>`;
}

/* ── HTTP Server ── */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Pin,X-SHA256',
    });
    return res.end();
  }

  // Dashboard
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/dashboard')) {
    const html = htmlDashboard();
    res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Length': Buffer.byteLength(html) });
    return res.end(html);
  }

  // API: pair
  if (req.method === 'POST' && url.pathname === '/api/pair') {
    const pin = req.headers['x-pin'] || '';
    if (pin === sessionPin) {
      paired = true;
      console.log(`[PAIR] Device paired successfully.`);
      return jsonResponse(res, 200, { success: true, message: 'Paired' });
    }
    return jsonResponse(res, 403, { success: false, message: 'Invalid PIN' });
  }

  // API: upload
  if (req.method === 'POST' && url.pathname === '/api/upload') {
    if (!paired) return jsonResponse(res, 403, { success: false, message: 'Not paired' });
    const expectedHash = (req.headers['x-sha256'] || '').toLowerCase();
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(chunks);
      const hash = sha256(buf);
      const verified = !expectedHash || hash === expectedHash;
      const name = `fieldguard-${timestamp()}.bin`;
      const outPath = path.join(DATA_DIR, name);
      fs.writeFileSync(outPath, buf);
      const entry = { name, size: buf.length, sha256: hash, ts: new Date().toISOString(), verified };
      receivedFiles.push(entry);
      console.log(`[UPLOAD] ${name} (${buf.length} bytes) SHA-256: ${hash.slice(0, 16)}... ${verified ? 'OK' : 'HASH MISMATCH'}`);
      return jsonResponse(res, 200, { success: true, ...entry });
    });
    return;
  }

  // API: status
  if (req.method === 'GET' && url.pathname === '/api/status') {
    return jsonResponse(res, 200, {
      version: VERSION,
      paired,
      files: receivedFiles.length,
      dataDir: DATA_DIR,
    });
  }

  // API: clear
  if (req.method === 'POST' && url.pathname === '/api/clear') {
    if (!paired) return jsonResponse(res, 403, { success: false, message: 'Not paired' });
    receivedFiles.length = 0;
    console.log('[CLEAR] File list cleared.');
    return jsonResponse(res, 200, { success: true });
  }

  // 404
  jsonResponse(res, 404, { error: 'Not Found' });
});

/* ── Startup ── */
function start() {
  ensureDir(DATA_DIR);
  sessionPin = generatePin();

  server.listen(PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║        LBS FieldGuard PC Bridge v' + VERSION + '        ║');
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log(`  ║  Port:  ${PORT}                                 ║`);
    console.log(`  ║  PIN:   ${sessionPin}                               ║`);
    console.log(`  ║  Logs:  ${DATA_DIR.length > 35 ? '~/' + path.basename(DATA_DIR) : DATA_DIR}`);
    console.log('  ╠══════════════════════════════════════════════╣');
    console.log('  ║  Dashboard: http://localhost:' + PORT + '/          ║');
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log('');
    console.log('  Enter this PIN in the mobile app to pair.');
    console.log('  Press Ctrl+C to exit.\n');
  });
}

start();
