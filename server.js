// server.js — ExecutiveShop
// Server HTTP nativo (senza Express: in questo ambiente non c'e' accesso alla rete
// per "npm install", quindi tutto e' costruito sui moduli core di Node.js 22+).
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const { Router } = require('./src/router');
const { getUserFromRequest } = require('./src/auth');
const { sendJson } = require('./src/utils');

const router = new Router();
require('./src/routes/auth.routes').register(router);
require('./src/routes/catalog.routes').register(router);
require('./src/routes/orders.routes').register(router);
require('./src/routes/payments.routes').register(router);
require('./src/routes/account.routes').register(router);
require('./src/routes/admin.routes').register(router);

const PUBLIC_DIR = path.join(__dirname, 'public');
const LOCALES_DIR = path.join(__dirname, 'locales');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function safeJoin(base, requestPath) {
  const target = path.normalize(path.join(base, requestPath));
  if (!target.startsWith(base)) return null; // blocca path traversal (../../)
  return target;
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  if (rel.endsWith('/')) rel += 'index.html';
  let filePath = safeJoin(PUBLIC_DIR, rel);
  if (!filePath) { res.writeHead(400); return res.end('Bad request'); }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // fallback: prova ad aggiungere .html (URL "puliti", es. /login -> /login.html)
      const withHtml = filePath + '.html';
      fs.stat(withHtml, (err2, stat2) => {
        if (!err2 && stat2.isFile()) return streamFile(res, withHtml);
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404</h1><p>Pagina non trovata.</p><a href="/">Torna alla home</a>');
      });
      return;
    }
    streamFile(res, filePath);
  });
}

function streamFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);
  const query = Object.fromEntries(parsedUrl.searchParams.entries());

  // ---- lingua: /locales/it.json ecc, serviti come statici semplici ----
  if (pathname.startsWith('/locales/')) {
    const file = safeJoin(LOCALES_DIR, pathname.replace('/locales', ''));
    if (file && fs.existsSync(file)) return streamFile(res, file);
    res.writeHead(404); return res.end('Not found');
  }

  // ---- API ----
  if (pathname.startsWith('/api/')) {
    const match = router.match(req.method, pathname);
    if (!match) return sendJson(res, 404, { error: 'Endpoint non trovato.' });

    const user = getUserFromRequest(req);
    if (match.auth === 'customer' && !user) return sendJson(res, 401, { error: 'Accesso richiesto.' });
    if (match.auth === 'admin' && (!user || user.role !== 'admin')) return sendJson(res, 403, { error: 'Accesso amministratore richiesto.' });

    req.user = user;
    try {
      await match.handler(req, res, match.params, query);
    } catch (e) {
      console.error('Errore route', pathname, e);
      if (!res.headersSent) sendJson(res, 500, { error: 'Errore interno del server.' });
    }
    return;
  }

  // ---- file statici / pagine ----
  if (req.method === 'GET') return serveStatic(req, res, pathname);

  res.writeHead(405); res.end('Method not allowed');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\nExecutiveShop in ascolto su http://localhost:${PORT}`);
});
