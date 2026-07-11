'use strict';
const { db } = require('../db');
const { sendJson, readJsonBody } = require('../utils');

function register(router) {

  // ---- Indirizzi ----
  router.get('/api/my/addresses', 'customer', async (req, res) => {
    const rows = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(req.user.id);
    sendJson(res, 200, { addresses: rows });
  });

  router.post('/api/my/addresses', 'customer', async (req, res) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (!b.line1 || !b.city || !b.postal_code || !b.country) return sendJson(res, 400, { error: 'Indirizzo incompleto.' });
    if (b.is_default) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(req.user.id);
    const r = db.prepare(`INSERT INTO addresses (user_id, label, line1, line2, city, state, postal_code, country, is_default)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(req.user.id, b.label || 'Indirizzo', b.line1, b.line2 || '', b.city, b.state || '', b.postal_code, b.country, b.is_default ? 1 : 0);
    sendJson(res, 201, { ok: true, id: r.lastInsertRowid });
  });

  router.del('/api/my/addresses/:id', 'customer', async (req, res, params) => {
    db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(params.id, req.user.id);
    sendJson(res, 200, { ok: true });
  });

  // ---- Wishlist ----
  router.get('/api/my/wishlist', 'customer', async (req, res) => {
    const rows = db.prepare(`SELECT p.* FROM wishlists w JOIN products p ON p.id = w.product_id WHERE w.user_id = ?`).all(req.user.id);
    sendJson(res, 200, { products: rows });
  });
  router.post('/api/my/wishlist/:productId', 'customer', async (req, res, params) => {
    try {
      db.prepare('INSERT OR IGNORE INTO wishlists (user_id, product_id) VALUES (?,?)').run(req.user.id, params.productId);
      sendJson(res, 201, { ok: true });
    } catch (e) { sendJson(res, 400, { error: 'Impossibile aggiungere alla wishlist.' }); }
  });
  router.del('/api/my/wishlist/:productId', 'customer', async (req, res, params) => {
    db.prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?').run(req.user.id, params.productId);
    sendJson(res, 200, { ok: true });
  });

  // ---- Wallet interno (store credit) ----
  router.get('/api/my/wallet', 'customer', async (req, res) => {
    const user = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(req.user.id);
    const tx = db.prepare('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
    sendJson(res, 200, { balance: user.wallet_balance, transactions: tx });
  });

  // ---- Ticket di supporto ----
  router.get('/api/my/tickets', 'customer', async (req, res) => {
    const rows = db.prepare('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    sendJson(res, 200, { tickets: rows });
  });
  router.post('/api/my/tickets', 'customer', async (req, res) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (!b.subject || !b.message) return sendJson(res, 400, { error: 'Oggetto e messaggio richiesti.' });
    const r = db.prepare('INSERT INTO tickets (user_id, subject, status) VALUES (?,?,?)').run(req.user.id, b.subject, 'open');
    db.prepare('INSERT INTO ticket_replies (ticket_id, sender_role, message) VALUES (?,?,?)').run(r.lastInsertRowid, 'customer', b.message);
    sendJson(res, 201, { ok: true, id: r.lastInsertRowid });
  });
  router.get('/api/my/tickets/:id', 'customer', async (req, res, params) => {
    const t = db.prepare('SELECT * FROM tickets WHERE id = ? AND user_id = ?').get(params.id, req.user.id);
    if (!t) return sendJson(res, 404, { error: 'Ticket non trovato.' });
    const replies = db.prepare('SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC').all(t.id);
    sendJson(res, 200, { ticket: t, replies });
  });

  // ---- Profilo ----
  router.put('/api/my/profile', 'customer', async (req, res) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (b.name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(b.name, req.user.id);
    if (b.avatar_url) db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(b.avatar_url, req.user.id);
    sendJson(res, 200, { ok: true });
  });
}

module.exports = { register };
