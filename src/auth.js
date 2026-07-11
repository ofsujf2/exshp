// src/auth.js
'use strict';
const crypto = require('crypto');
const { db, hashPassword } = require('./db');

// In produzione questo segreto va in variabile d'ambiente (vedi .env.example).
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me-in-prod';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 giorni

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function sign(payloadObj) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function createSessionToken(user, remember) {
  return sign({
    uid: user.id,
    role: user.role,
    exp: Date.now() + (remember ? SESSION_TTL_MS : 1000 * 60 * 60 * 4)
  });
}

function getUserFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies['esh_session'];
  const data = verify(token);
  if (!data) return null;
  const user = db.prepare('SELECT id, email, name, role, is_verified, avatar_url, wallet_balance FROM users WHERE id = ?').get(data.uid);
  return user || null;
}

function parseCookies(header) {
  const out = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function sessionCookie(token) {
  const maxAge = SESSION_TTL_MS / 1000;
  return `esh_session=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function clearSessionCookie() {
  return `esh_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

// semplice rate limiter in memoria per endpoint sensibili (login, register)
const attempts = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const entry = attempts.get(key) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  attempts.set(key, entry);
  return entry.count <= max;
}

module.exports = {
  verifyPassword, createSessionToken, getUserFromRequest,
  sessionCookie, clearSessionCookie, parseCookies, rateLimit
};
