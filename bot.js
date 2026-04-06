'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT         = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.warn('[KYOU] Warning: GROQ_API_KEY is not set. API calls will fail.');
}

/* ── MIME types ─────────────────────────────────────── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
};

/* ── Static file helper ─────────────────────────────── */
function serveStatic(req, res) {
  const urlPath  = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.join(__dirname, urlPath);
  const ext      = path.extname(filePath).toLowerCase();

  if (!filePath.startsWith(__dirname + path.sep)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ── Groq proxy ─────────────────────────────────────── */
function proxyToGroq(req, res) {
  let body = '';

  req.on('data', chunk => { body += chunk; });
  req.on('error', () => {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Bad request' } }));
  });

  req.on('end', () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: { message: 'Invalid JSON' } }));
    }

    const payload = Buffer.from(JSON.stringify(parsed));

    const options = {
      hostname: 'api.groq.com',
      port:     443,
      path:     '/openai/v1/chat/completions',
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': payload.length,
        'Authorization':  `Bearer ${GROQ_API_KEY}`,
      },
    };

    const upstream = https.request(options, upstreamRes => {
      let upstreamBody = '';
      upstreamRes.on('data', chunk => { upstreamBody += chunk; });
      upstreamRes.on('end', () => {
        res.writeHead(upstreamRes.statusCode, { 'Content-Type': 'application/json' });
        res.end(upstreamBody);
      });
    });

    upstream.on('error', err => {
      console.error('[KYOU] Upstream error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Bad gateway' } }));
    });

    upstream.write(payload);
    upstream.end();
  });
}

/* ── Server ─────────────────────────────────────────── */
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/api/messages') {
    return proxyToGroq(req, res);
  }

  if (req.method === 'GET') {
    return serveStatic(req, res);
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`[KYOU] Server running → http://localhost:${PORT}`);
});
