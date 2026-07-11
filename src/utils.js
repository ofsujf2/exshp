// src/utils.js
'use strict';
const crypto = require('crypto');
const { db } = require('./db');

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer-when-downgrade'
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 5 * 1024 * 1024) { // 5MB limite
        reject(new Error('Payload troppo grande'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch { reject(new Error('JSON non valido')); }
    });
    req.on('error', reject);
  });
}

function orderNumber() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `ESH-${stamp}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function auditLog(actorId, action, meta) {
  db.prepare('INSERT INTO audit_logs (actor_id, action, meta) VALUES (?,?,?)')
    .run(actorId || null, action, meta ? JSON.stringify(meta) : null);
}

// Genera un pattern "a griglia" deterministico a partire da una stringa (indirizzo wallet),
// puramente visivo: NON e' un vero QR code decodificabile (servirebbe una libreria dedicata,
// non installabile qui senza rete). E' pensato come placeholder scansionabile "a vista" nella demo,
// da sostituire con una vera libreria (es. 'qrcode') in produzione.
function placeholderCodeSvg(text, size = 180) {
  const hash = crypto.createHash('sha256').update(text).digest();
  const cells = 14;
  const cell = size / cells;
  let rects = '';
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const bit = (hash[(y * cells + x) % hash.length] >> (x % 8)) & 1;
      if (bit) {
        rects += `<rect x="${(x * cell).toFixed(1)}" y="${(y * cell).toFixed(1)}" width="${cell.toFixed(1)}" height="${cell.toFixed(1)}" fill="#0a84ff"/>`;
      }
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#0d1117"/>${rects}</svg>`;
}

function slugify(str) {
  return String(str).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
}

module.exports = {
  sendJson, readJsonBody, orderNumber, auditLog, placeholderCodeSvg, slugify, getSetting, setSetting
};
