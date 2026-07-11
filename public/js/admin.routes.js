'use strict';
const { db } = require('../db');
const { sendJson, readJsonBody, orderNumber, auditLog } = require('../utils');
const { fulfillDigitalItem } = require('./orders.routes');

function register(router) {

  // ==================== UPLOAD IMMAGINE ====================
  router.post('/api/admin/upload', 'admin', async (req, res) => {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (!body.data_url) return sendJson(res, 400, { error: 'data_url required' });
    // Restituisci direttamente il base64 come URL
    sendJson(res, 200, { url: body.data_url });
  });

  // ==================== STATS ====================
  router.get('/api/admin/stats', 'admin', async (req, res) => {
    const revenue = db.prepare("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE payment_status = 'paid'").get();
    const orders_count = db.prepare("SELECT COUNT(*) as c FROM orders").get();
    const customers = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'customer'").get();
    const pending_orders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE payment_status = 'pending_verification'").get();

    const sales_by_day = db.prepare(`
      SELECT DATE(created_at) as day, SUM(total) as total FROM orders 
      WHERE created_at >= DATE('now', '-14 days') GROUP BY day ORDER BY day
    `).all();

    const top_products = db.prepare(`
      SELECT p.title, COUNT(oi.id) as sold FROM order_items oi 
      JOIN products p ON p.id = oi.product_id GROUP BY oi.product_id ORDER BY sold DESC LIMIT 5
    `).all();

    const latest_orders = db.prepare(`
      SELECT o.*, u.name as customer_name, u.email as customer_email FROM orders o 
      LEFT JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 10
    `).all();

    const low_stock = db.prepare("SELECT * FROM products WHERE type = 'physical' AND unlimited_stock = 0 AND stock < 5 AND status = 'published'").all();

    sendJson(res, 200, {
      revenue: revenue.total, orders_count: orders_count.c, customers: customers.c,
      pending_orders: pending_orders.c, sales_by_day, top_products, latest_orders, low_stock
    });
  });

  // ==================== PRODOTTI ====================
  router.get('/api/admin/products', 'admin', async (req, res) => {
    const rows = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
    sendJson(res, 200, { products: rows });
  });

  router.post('/api/admin/products', 'admin', async (req, res) => {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (!body.title) return sendJson(res, 400, { error: 'Title required.' });

    const slug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const r = db.prepare(`INSERT INTO products (title, slug, description, category_id, brand, type, price, discount_price, sku, stock, unlimited_stock, thumbnail, delivery_type, status, featured, trending, new_arrival, cost, shipping_weight, shipping_size, seo_title, seo_description, seo_keywords, visibility)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(
        body.title, slug, body.description || '', body.category_id || null, body.brand || '',
        body.type || 'physical', body.price || 0, body.discount_price || null, body.sku || null,
        body.stock || 0, body.unlimited_stock ? 1 : 0, body.thumbnail || '', body.delivery_type || 'none',
        body.status || 'draft', body.featured ? 1 : 0, body.trending ? 1 : 0, body.new_arrival ? 1 : 0,
        body.cost || 0, body.shipping_weight || null, body.shipping_size || null,
        body.seo_title || '', body.seo_description || '', body.seo_keywords || '', 'public'
      );
    auditLog(req.user.id, 'product.created', { id: r.lastInsertRowid, title: body.title });
    sendJson(res, 201, { ok: true, id: r.lastInsertRowid });
  });

  router.put('/api/admin/products/:id', 'admin', async (req, res, params) => {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(params.id);
    if (!existing) return sendJson(res, 404, { error: 'Product not found.' });

    db.prepare(`UPDATE products SET title=?, description=?, category_id=?, brand=?, type=?, price=?, discount_price=?, sku=?, stock=?, unlimited_stock=?, thumbnail=?, delivery_type=?, status=?, featured=?, trending=?, new_arrival=?, cost=?, shipping_weight=?, shipping_size=?, seo_title=?, seo_description=?, seo_keywords=? WHERE id=?`)
      .run(
        body.title || existing.title, body.description ?? existing.description, body.category_id ?? existing.category_id,
        body.brand ?? existing.brand, body.type || existing.type, body.price ?? existing.price,
        body.discount_price ?? existing.discount_price, body.sku ?? existing.sku,
        body.stock ?? existing.stock, body.unlimited_stock ?? existing.unlimited_stock,
        body.thumbnail ?? existing.thumbnail, body.delivery_type || existing.delivery_type,
        body.status || existing.status, body.featured ?? existing.featured,
        body.trending ?? existing.trending, body.new_arrival ?? existing.new_arrival,
        body.cost ?? existing.cost, body.shipping_weight ?? existing.shipping_weight,
        body.shipping_size ?? existing.shipping_size, body.seo_title ?? existing.seo_title,
        body.seo_description ?? existing.seo_description, body.seo_keywords ?? existing.seo_keywords,
        params.id
      );
    auditLog(req.user.id, 'product.updated', { id: params.id });
    sendJson(res, 200, { ok: true });
  });

  router.delete('/api/admin/products/:id', 'admin', async (req, res, params) => {
    db.prepare("DELETE FROM products WHERE id = ?").run(params.id);
    auditLog(req.user.id, 'product.deleted', { id: params.id });
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/admin/products/:id/duplicate', 'admin', async (req, res, params) => {
    const p = db.prepare("SELECT * FROM products WHERE id = ?").get(params.id);
    if (!p) return sendJson(res, 404, { error: 'Product not found.' });
    const r = db.prepare(`INSERT INTO products (title, slug, description, category_id, brand, type, price, discount_price, cost, sku, stock, unlimited_stock, thumbnail, delivery_type, status, featured, trending, new_arrival, visibility, shipping_weight, shipping_size, seo_title, seo_description, seo_keywords)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(
        p.title + ' (copia)', p.slug + '-copy', p.description, p.category_id, p.brand, p.type,
        p.price, p.discount_price, p.cost, (p.sku || '') + '-COPY', p.stock, p.unlimited_stock,
        p.thumbnail, p.delivery_type, 'draft', p.featured, p.trending, p.new_arrival,
        p.visibility, p.shipping_weight, p.shipping_size, p.seo_title, p.seo_description, p.seo_keywords
      );
    sendJson(res, 201, { ok: true, id: r.lastInsertRowid });
  });

  // ==================== ORDINI ====================
  router.get('/api/admin/orders', 'admin', async (req, res) => {
    const rows = db.prepare("SELECT o.*, u.name as customer_name, u.email as customer_email FROM orders o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC").all();
    sendJson(res, 200, { orders: rows });
  });

  router.get('/api/admin/orders/:id', 'admin', async (req, res, params) => {
    const order = db.prepare("SELECT o.*, u.name as customer_name, u.email as customer_email FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.id = ?").get(params.id);
    if (!order) return sendJson(res, 404, { error: 'Order not found.' });
    const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(order.id);
    sendJson(res, 200, { order, items });
  });

  router.put('/api/admin/orders/:id', 'admin', async (req, res, params) => {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const existing = db.prepare("SELECT * FROM orders WHERE id = ?").get(params.id);
    if (!existing) return sendJson(res, 404, { error: 'Order not found.' });

    const oldStatus = existing.payment_status;
    db.prepare(`UPDATE orders SET status=?, payment_status=?, tracking_number=?, carrier=?, notes=? WHERE id=?`)
      .run(body.status || existing.status, body.payment_status || existing.payment_status,
        body.tracking_number ?? existing.tracking_number, body.carrier ?? existing.carrier,
        body.notes ?? existing.notes, params.id);

    // Se pagamento passato a "paid", consegna beni digitali
    if (body.payment_status === 'paid' && oldStatus !== 'paid') {
      const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(existing.id);
      for (const it of items) {
        if (it.type !== 'digital') continue;
        const product = db.prepare("SELECT * FROM products WHERE id = ?").get(it.product_id);
        if (product) fulfillDigitalItem(product, existing);
      }
    }

    auditLog(req.user.id, 'order.updated', { id: params.id, body });
    sendJson(res, 200, { ok: true });
  });

  // ==================== COUPON ====================
  router.get('/api/admin/coupons', 'admin', async (req, res) => {
    const rows = db.prepare("SELECT * FROM coupons ORDER BY created_at DESC").all();
    sendJson(res, 200, { coupons: rows });
  });

  router.post('/api/admin/coupons', 'admin', async (req, res) => {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (!body.code) return sendJson(res, 400, { error: 'Code required.' });
    const r = db.prepare("INSERT INTO coupons (code, type, value, usage_limit, min_order, status) VALUES (?,?,?,?,?,?)")
      .run(body.code.toUpperCase(), body.type || 'percentage', body.value || 0, body.usage_limit || null, body.min_order || null, 'active');
    sendJson(res, 201, { ok: true, id: r.lastInsertRowid });
  });

  router.put('/api/admin/coupons/:id', 'admin', async (req, res, params) => {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (body.status) {
      db.prepare("UPDATE coupons SET status = ? WHERE id = ?").run(body.status, params.id);
    }
    sendJson(res, 200, { ok: true });
  });

  router.delete('/api/admin/coupons/:id', 'admin', async (req, res, params) => {
    db.prepare("DELETE FROM coupons WHERE id = ?").run(params.id);
    sendJson(res, 200, { ok: true });
  });

  // ==================== WALLET ====================
  router.get('/api/admin/wallets', 'admin', async (req, res) => {
    const rows = db.prepare("SELECT * FROM wallets ORDER BY id ASC").all();
    sendJson(res, 200, { wallets: rows });
  });

  router.post('/api/admin/wallets', 'admin', async (req, res) => {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (!body.name || !body.address) return sendJson(res, 400, { error: 'Name and address required.' });
    const r = db.prepare("INSERT INTO wallets (name, network, address, min_amount, auto_verify, status) VALUES (?,?,?,?,?,?)")
      .run(body.name, body.network || 'BTC', body.address, body.min_amount || 0, body.auto_verify ? 1 : 0, 'active');
    sendJson(res, 201, { ok: true, id: r.lastInsertRowid });
  });

  router.put('/api/admin/wallets/:id', 'admin', async (req, res, params) => {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (body.status) {
      db.prepare("UPDATE wallets SET status = ? WHERE id = ?").run(body.status, params.id);
    }
    sendJson(res, 200, { ok: true });
  });

  router.delete('/api/admin/wallets/:id', 'admin', async (req, res, params) => {
    db.prepare("DELETE FROM wallets WHERE id = ?").run(params.id);
    sendJson(res, 200, { ok: true });
  });

  // ==================== GATEWAY ====================
  router.get('/api/admin/gateways', 'admin', async (req, res) => {
    const rows = db.prepare("SELECT * FROM payment_gateways ORDER BY id ASC").all();
    const result = rows.map(g => ({
      ...g,
      configured: !!(process.env[g.code.toUpperCase() + '_PUBLIC_KEY'] || process.env[g.code.toUpperCase() + '_SECRET_KEY'] || process.env[g.code.toUpperCase() + '_CLIENT_ID'] || process.env[g.code.toUpperCase() + '_API_KEY'])
    }));
    sendJson(res, 200, { gateways: result });
  });

  router.put('/api/admin/gateways/:id', 'admin', async (req, res, params) => {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (body.status) {
      db.prepare("UPDATE payment_gateways SET status = ? WHERE id = ?").run(body.status, params.id);
    }
    sendJson(res, 200, { ok: true });
  });

  // ==================== API PROVIDER ====================
  router.get('/api/admin/api-providers', 'admin', async (req, res) => {
    const rows = db.prepare("SELECT * FROM api_providers ORDER BY id ASC").all();
    sendJson(res, 200, { providers: rows });
  });

  router.post('/api/admin/api-providers', 'admin', async (req, res) => {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const r = db.prepare("INSERT INTO api_providers (name, endpoint, api_key, api_secret, status) VALUES (?,?,?,?,?)")
      .run(body.name, body.endpoint, body.api_key || '', body.api_secret || '', body.status || 'disabled');
    sendJson(res, 201, { ok: true, id: r.lastInsertRowid });
  });

  router.delete('/api/admin/api-providers/:id', 'admin', async (req, res, params) => {
    db.prepare("DELETE FROM api_providers WHERE id = ?").run(params.id);
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/admin/api-providers/:id/test', 'admin', async (req, res, params) => {
    const provider = db.prepare("SELECT * FROM api_providers WHERE id = ?").get(params.id);
    if (!provider) return sendJson(res, 404, { error: 'Provider not found.' });
    sendJson(res, 200, { ok: false, message: 'Test connessione non disponibile in ambiente sandbox (nessuna rete in uscita).' });
  });

  // ==================== RECENSIONI ====================
  router.get('/api/admin/reviews', 'admin', async (req, res) => {
    const rows = db.prepare("SELECT r.*, p.title as product_title, u.name as user_name FROM reviews r LEFT JOIN products p ON p.id = r.product_id LEFT JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC").all();
    sendJson(res, 200, { reviews: rows });
  });

  router.put('/api/admin/reviews/:id', 'admin', async (req, res, params) => {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (body.status) {
      db.prepare("UPDATE reviews SET status = ? WHERE id = ?").run(body.status, params.id);
    }
    sendJson(res, 200, { ok: true });
  });

  // ==================== TICKET ====================
  router.get('/api/admin/tickets', 'admin', async (req, res) => {
    const rows = db.prepare("SELECT t.*, u.name as user_name, u.email as user_email FROM tickets t LEFT JOIN users u ON u.id = t.user_id ORDER BY t.created_at DESC").all();
    sendJson(res, 200, { tickets: rows });
  });

  router.post('/api/admin/tickets/:id/reply', 'admin', async (req, res, params) => {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    db.prepare("INSERT INTO ticket_replies (ticket_id, sender_role, message) VALUES (?, 'admin', ?)").run(params.id, body.message);
    if (body.status) {
      db.prepare("UPDATE tickets SET status = ? WHERE id = ?").run(body.status, params.id);
    }
    sendJson(res, 200, { ok: true });
  });

  // ==================== SETTINGS ====================
  router.get('/api/admin/settings', 'admin', async (req, res) => {
    const rows = db.prepare("SELECT * FROM settings").all();
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    sendJson(res, 200, { settings });
  });

  router.put('/api/admin/settings', 'admin', async (req, res) => {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)");
    for (const [key, value] of Object.entries(body)) {
      stmt.run(key, String(value));
    }
    sendJson(res, 200, { ok: true });
  });
}

module.exports = { register };