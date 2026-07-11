'use strict';
const { db } = require('../db');
const { sendJson, readJsonBody } = require('../utils');

function parseProduct(p) {
  if (!p) return p;
  return {
    ...p,
    gallery: safeJson(p.gallery, []),
    tags: safeJson(p.tags, []),
    specifications: safeJson(p.specifications, {}),
    // campi sensibili nascosti nella vista pubblica
    cost: undefined, digital_file_url: undefined, api_provider_id: undefined
  };
}
function safeJson(v, fallback) { try { return v ? JSON.parse(v) : fallback; } catch { return fallback; } }

function register(router) {

  router.get('/api/categories', 'public', async (req, res) => {
    const rows = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC').all();
    sendJson(res, 200, { categories: rows });
  });

  router.get('/api/products', 'public', async (req, res, params, query) => {
    const where = ["status = 'published'"];
    const args = [];
    if (query.category) { where.push('category_id = (SELECT id FROM categories WHERE slug = ?)'); args.push(query.category); }
    if (query.type) { where.push('type = ?'); args.push(query.type); }
    if (query.featured) { where.push('featured = 1'); }
    if (query.trending) { where.push('trending = 1'); }
    if (query.new_arrival) { where.push('new_arrival = 1'); }
    if (query.q) { where.push('(title LIKE ? OR description LIKE ? OR tags LIKE ?)'); args.push(`%${query.q}%`, `%${query.q}%`, `%${query.q}%`); }

    const sql = `SELECT * FROM products WHERE ${where.join(' AND ')} ORDER BY created_at DESC`;
    const rows = db.prepare(sql).all(...args);
    sendJson(res, 200, { products: rows.map(parseProduct) });
  });

  router.get('/api/products/:slug', 'public', async (req, res, params) => {
    const p = db.prepare("SELECT * FROM products WHERE slug = ? AND status = 'published'").get(params.slug);
    if (!p) return sendJson(res, 404, { error: 'Prodotto non trovato.' });
    const reviews = db.prepare(`SELECT r.rating, r.comment, r.verified_purchase, r.created_at, u.name as user_name
      FROM reviews r LEFT JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ? AND r.status = 'approved' ORDER BY r.created_at DESC`).all(p.id);
    const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : null;
    sendJson(res, 200, { product: parseProduct(p), reviews, rating_average: avg, rating_count: reviews.length });
  });

  router.post('/api/products/:slug/reviews', 'customer', async (req, res, params) => {
    const p = db.prepare('SELECT id FROM products WHERE slug = ?').get(params.slug);
    if (!p) return sendJson(res, 404, { error: 'Prodotto non trovato.' });
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const rating = Math.max(1, Math.min(5, Number(body.rating) || 0));
    if (!rating) return sendJson(res, 400, { error: 'Valutazione non valida (1-5).' });

    const purchased = db.prepare(`SELECT COUNT(*) as c FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.user_id = ? AND oi.product_id = ? AND o.payment_status = 'paid'`).get(req.user.id, p.id);

    db.prepare(`INSERT INTO reviews (product_id, user_id, rating, comment, status, verified_purchase)
      VALUES (?,?,?,?,?,?)`)
      .run(p.id, req.user.id, rating, body.comment || '', 'pending', purchased.c > 0 ? 1 : 0);

    sendJson(res, 201, { ok: true, message: 'Recensione inviata, in attesa di approvazione.' });
  });

  router.get('/api/track-order/:orderNumber', 'public', async (req, res, params, query) => {
    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(params.orderNumber);
    if (!order) return sendJson(res, 404, { error: 'Ordine non trovato.' });
    // per sicurezza: richiede anche l'email del cliente che ha effettuato l'ordine
    if (query.email) {
      const user = order.user_id ? db.prepare('SELECT email FROM users WHERE id = ?').get(order.user_id) : null;
      if (!user || user.email.toLowerCase() !== String(query.email).toLowerCase()) {
        return sendJson(res, 403, { error: 'Email non corrispondente all\'ordine.' });
      }
    } else {
      return sendJson(res, 400, { error: 'Email richiesta per verificare l\'ordine.' });
    }
    const items = db.prepare('SELECT title, price, quantity FROM order_items WHERE order_id = ?').all(order.id);
    sendJson(res, 200, {
      order_number: order.order_number, status: order.status, payment_status: order.payment_status,
      tracking_number: order.tracking_number, carrier: order.carrier, total: order.total,
      currency: order.currency, created_at: order.created_at, items
    });
  });
}

module.exports = { register };
