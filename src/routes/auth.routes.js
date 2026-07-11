'use strict';
const { db, hashPassword } = require('../db');
const { verifyPassword, createSessionToken, sessionCookie, clearSessionCookie, rateLimit } = require('../auth');
const { sendJson, readJsonBody, auditLog } = require('../utils');

function register(router) {

  router.post('/api/auth/register', 'public', async (req, res) => {
    if (!rateLimit('register:' + (req.socket.remoteAddress || ''), 10, 60_000)) {
      return sendJson(res, 429, { error: 'Troppi tentativi. Riprova tra un minuto.' });
    }
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const { email, password, name } = body;
    if (!email || !password || !name) return sendJson(res, 400, { error: 'Campi mancanti (nome, email, password).' });
    if (password.length < 8) return sendJson(res, 400, { error: 'La password deve avere almeno 8 caratteri.' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) return sendJson(res, 409, { error: 'Email gia registrata.' });

    const { hash, salt } = hashPassword(password);
    const r = db.prepare('INSERT INTO users (email, password_hash, salt, name, role, is_verified) VALUES (?,?,?,?,?,?)')
      .run(email.toLowerCase(), hash, salt, name, 'customer', 0);

    auditLog(r.lastInsertRowid, 'user.register', { email });
    // In produzione: invio email di verifica reale via SMTP (vedi .env.example / settings SMTP).
    const token = createSessionToken({ id: r.lastInsertRowid, role: 'customer' }, true);
    res.setHeader('Set-Cookie', sessionCookie(token));
    sendJson(res, 201, { ok: true, message: 'Registrazione completata. Verifica email simulata (nessun invio reale in questo ambiente).' });
  });

  router.post('/api/auth/login', 'public', async (req, res) => {
    const ip = req.socket.remoteAddress || '';
    if (!rateLimit('login:' + ip, 8, 60_000)) {
      return sendJson(res, 429, { error: 'Troppi tentativi di login. Riprova tra un minuto.' });
    }
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const { email, password, remember } = body;
    if (!email || !password) return sendJson(res, 400, { error: 'Email e password richieste.' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
    if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
      auditLog(null, 'user.login.failed', { email });
      return sendJson(res, 401, { error: 'Credenziali non valide.' });
    }
    const token = createSessionToken(user, !!remember);
    res.setHeader('Set-Cookie', sessionCookie(token));
    auditLog(user.id, 'user.login', {});
    sendJson(res, 200, {
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  });

  router.post('/api/auth/logout', 'public', async (req, res) => {
    res.setHeader('Set-Cookie', clearSessionCookie());
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/auth/forgot-password', 'public', async (req, res) => {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(String(body.email || '').toLowerCase());
    // Risposta identica in ogni caso, per non rivelare quali email esistono.
    sendJson(res, 200, { ok: true, message: 'Se l\'indirizzo esiste, riceverai un\'email con le istruzioni (invio SMTP non attivo in questa demo).' });
    if (user) auditLog(user.id, 'user.forgot_password.requested', {});
  });

  router.get('/api/auth/me', 'any', async (req, res) => {
    if (!req.user) return sendJson(res, 200, { user: null });
    sendJson(res, 200, { user: req.user });
  });
}

module.exports = { register };
