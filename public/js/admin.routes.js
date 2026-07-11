'use strict';
const { db } = require('../db');
const { sendJson, readJsonBody, auditLog, slugify, getSetting, setSetting } = require('../utils');

function register(router) {

  // ---------------- DASHBOARD ----------------
  router.get('/api/admin/stats', 'admin', async (req, res) => {
    const revenue = db.prepare("SELECT COALESCE(SUM(total),0) as v FROM orders WHERE payment_status = 'paid'").get().v;
    const ordersCount = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    const customers = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'customer'").get().c;
    const pendingOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE payment_status = 'pending_verification'").get().c;
    const lowStock = db.prepare("SELECT id, title, stock FROM products WHERE unlimited_stock = 0 AND stock <= 5 AND type = 'physical'").all();

    const salesByDay = db.prepare(`
      SELECT substr(created_at,1,10) as day, SUM(total) as total, COUNT(*) as orders
      FROM orders WHERE payment_status = 'paid'
      GROUP BY day ORDER BY day DESC LIMIT 14
    `).all().reverse();

    const topProducts = db.prepare(`
      SELECT p.title, SUM(oi.quantity) as sold, SUM(oi.price * oi.quantity) as revenue
      FROM order_items oi JOIN products p ON p.id = oi.product_id
      JOIN orders o ON o.id = oi.order_id WHERE o.payment_status = 'paid'
      GROUP BY oi.product_id ORDER BY sold DESC LIMIT 5
    `).all();

    const paymentMethods = db.prepare(`
      SELECT payment_method, COUNT(*) as c FROM orders GROUP BY payment_method
    `).all();

    const latestOrders = db.prepare(`
      SELECT o.order_number, o.total, o.status, o.payment_status, o.created_at, u.name as customer_name
      FROM orders o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 8
    `).all();

    const latestCustomers = db.prepare(`SELECT id, name, email, created_at FROM users WHERE role='customer' ORDER BY created_at DESC LIMIT 6`).all();

    sendJson(res, 200, {
      revenue, orders_count: ordersCount, customers, pending_orders: pendingOrders,
      low_stock: lowStock, sales_by_day: salesByDay, top_products: topProducts,
      payment_methods: paymentMethods, latest_orders: latestOrders, latest_customers: latestCustomers,
      conversion_rate: null // richiederebbe tracking sessioni/visitatori reale, non simulato qui
    });
  });

  // ---------------- PRODOTTI ----------------
  router.get('/api/admin/products', 'admin', async (req, res) => {
    const rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
    sendJson(res, 200, { products: rows });
  });

  router.post('/api/admin/products', 'admin', async (req, res) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (!b.title || !b.price) return sendJson(res, 400, { error: 'Titolo e prezzo sono obbligatori.' });
    const slug = b.slug ? slugify(b.slug) : slugify(b.title) + '-' + Date.now().toString(36);
    try {
      const r = db.prepare(`INSERT INTO products
        (title, slug, description, category_id, brand, type, price, discount_price, cost, sku, stock, unlimited_stock,
         thumbnail, gallery, tags, specifications, digital_file_url, delivery_type, api_provider_id, download_limit,
         shipping_weight, shipping_size, status, seo_title, seo_description, seo_keywords,
         featured, trending, recommended, new_arrival, visibility)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(
          b.title, slug, b.description || '', b.category_id || null, b.brand || '', b.type || 'physical',
          Number(b.price), b.discount_price ? Number(b.discount_price) : null, b.cost ? Number(b.cost) : null,
          b.sku || null, Number(b.stock) || 0, b.unlimited_stock ? 1 : 0,
          b.thumbnail || '', JSON.stringify(b.gallery || []), JSON.stringify(b.tags || []), JSON.stringify(b.specifications || {}),
          b.digital_file_url || '', b.delivery_type || 'none', b.api_provider_id || null, Number(b.download_limit) || 0,
          b.shipping_weight ? Number(b.shipping_weight) : null, b.shipping_size || null,
          b.status || 'draft', b.seo_title || '', b.seo_description || '', b.seo_keywords || '',
          b.featured ? 1 : 0, b.trending ? 1 : 0, b.recommended ? 1 : 0, b.new_arrival ? 1 : 0, b.visibility || 'public'
        );
      auditLog(req.user.id, 'product.create', { id: r.lastInsertRowid, title: b.title });
      sendJson(res, 201, { ok: true, id: r.lastInsertRowid });
    } catch (e) {
      sendJson(res, 400, { error: 'Errore creazione prodotto (slug o SKU duplicati?).' });
    }
  });

  router.put('/api/admin/products/:id', 'admin', async (req, res, params) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(params.id);
    if (!existing) return sendJson(res, 404, { error: 'Prodotto non trovato.' });

    const merged = {
      title: b.title ?? existing.title, description: b.description ?? existing.description,
      category_id: b.category_id ?? existing.category_id, brand: b.brand ?? existing.brand,
      type: b.type ?? existing.type, price: b.price ?? existing.price,
      discount_price: b.discount_price ?? existing.discount_price, cost: b.cost ?? existing.cost,
      sku: b.sku ?? existing.sku, stock: b.stock ?? existing.stock,
      unlimited_stock: b.unlimited_stock ?? existing.unlimited_stock,
      thumbnail: body.thumbnail || null,
      gallery: b.gallery ? JSON.stringify(b.gallery) : existing.gallery,
      tags: b.tags ? JSON.stringify(b.tags) : existing.tags,
      specifications: b.specifications ? JSON.stringify(b.specifications) : existing.specifications,
      digital_file_url: b.digital_file_url ?? existing.digital_file_url,
      delivery_type: b.delivery_type ?? existing.delivery_type,
      api_provider_id: b.api_provider_id ?? existing.api_provider_id,
      download_limit: b.download_limit ?? existing.download_limit,
      shipping_weight: b.shipping_weight ?? existing.shipping_weight,
      shipping_size: b.shipping_size ?? existing.shipping_size,
      status: b.status ?? existing.status,
      seo_title: b.seo_title ?? existing.seo_title, seo_description: b.seo_description ?? existing.seo_description,
      seo_keywords: b.seo_keywords ?? existing.seo_keywords,
      featured: b.featured ?? existing.featured, trending: b.trending ?? existing.trending,
      recommended: b.recommended ?? existing.recommended, new_arrival: b.new_arrival ?? existing.new_arrival,
      visibility: b.visibility ?? existing.visibility
    };

    db.prepare(`UPDATE products SET title=?, description=?, category_id=?, brand=?, type=?, price=?, discount_price=?,
      cost=?, sku=?, stock=?, unlimited_stock=?, thumbnail=?, gallery=?, tags=?, specifications=?, digital_file_url=?,
      delivery_type=?, api_provider_id=?, download_limit=?, shipping_weight=?, shipping_size=?, status=?, seo_title=?,
      seo_description=?, seo_keywords=?, featured=?, trending=?, recommended=?, new_arrival=?, visibility=? WHERE id=?`)
      .run(merged.title, merged.description, merged.category_id, merged.brand, merged.type, merged.price, merged.discount_price,
        merged.cost, merged.sku, merged.stock, merged.unlimited_stock, merged.thumbnail, merged.gallery, merged.tags,
        merged.specifications, merged.digital_file_url, merged.delivery_type, merged.api_provider_id, merged.download_limit,
        merged.shipping_weight, merged.shipping_size, merged.status, merged.seo_title, merged.seo_description,
        merged.seo_keywords, merged.featured, merged.trending, merged.recommended, merged.new_arrival, merged.visibility, params.id);

    auditLog(req.user.id, 'product.update', { id: params.id });
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/admin/products/:id/duplicate', 'admin', async (req, res, params) => {
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(params.id);
    if (!p) return sendJson(res, 404, { error: 'Prodotto non trovato.' });
    const newSlug = p.slug + '-copia-' + Date.now().toString(36);
    const r = db.prepare(`INSERT INTO products (title, slug, description, category_id, brand, type, price, discount_price,
      cost, sku, stock, unlimited_stock, thumbnail, gallery, tags, specifications, digital_file_url, delivery_type,
      api_provider_id, download_limit, shipping_weight, shipping_size, status, seo_title, seo_description, seo_keywords,
      featured, trending, recommended, new_arrival, visibility)
      SELECT title || ' (copia)', ?, description, category_id, brand, type, price, discount_price, cost, NULL, stock,
      unlimited_stock, thumbnail, gallery, tags, specifications, digital_file_url, delivery_type, api_provider_id,
      download_limit, shipping_weight, shipping_size, 'draft', seo_title, seo_description, seo_keywords,
      0, 0, 0, 0, visibility FROM products WHERE id = ?`).run(newSlug, params.id);
    sendJson(res, 201, { ok: true, id: r.lastInsertRowid });
  });

  router.del('/api/admin/products/:id', 'admin', async (req, res, params) => {
    db.prepare('DELETE FROM products WHERE id = ?').run(params.id);
    auditLog(req.user.id, 'product.delete', { id: params.id });
    sendJson(res, 200, { ok: true });
  });

  // ---------------- CATEGORIE ----------------
  router.get('/api/admin/categories', 'admin', async (req, res) => {
    sendJson(res, 200, { categories: db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all() });
  });
  router.post('/api/admin/categories', 'admin', async (req, res) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (!b.name) return sendJson(res, 400, { error: 'Nome richiesto.' });
    const slug = b.slug ? slugify(b.slug) : slugify(b.name);
    const r = db.prepare('INSERT INTO categories (name, slug, parent_id, icon, image, sort_order) VALUES (?,?,?,?,?,?)')
      .run(b.name, slug, b.parent_id || null, b.icon || '', b.image || '', b.sort_order || 0);
    sendJson(res, 201, { ok: true, id: r.lastInsertRowid });
  });
  router.put('/api/admin/categories/:id', 'admin', async (req, res, params) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    db.prepare('UPDATE categories SET name=?, icon=?, image=?, sort_order=? WHERE id=?')
      .run(b.name, b.icon || '', b.image || '', b.sort_order || 0, params.id);
    sendJson(res, 200, { ok: true });
  });
  router.del('/api/admin/categories/:id', 'admin', async (req, res, params) => {
    db.prepare('DELETE FROM categories WHERE id = ?').run(params.id);
    sendJson(res, 200, { ok: true });
  });

  // ---------------- ORDINI ----------------
  router.get('/api/admin/orders', 'admin', async (req, res, params, query) => {
    let sql = `SELECT o.*, u.name as customer_name, u.email as customer_email FROM orders o LEFT JOIN users u ON u.id = o.user_id`;
    const args = [];
    if (query.status) { sql += ' WHERE o.status = ?'; args.push(query.status); }
    sql += ' ORDER BY o.created_at DESC';
    sendJson(res, 200, { orders: db.prepare(sql).all(...args) });
  });

  router.get('/api/admin/orders/:id', 'admin', async (req, res, params) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(params.id);
    if (!order) return sendJson(res, 404, { error: 'Ordine non trovato.' });
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    sendJson(res, 200, { order, items });
  });

  router.put('/api/admin/orders/:id', 'admin', async (req, res, params) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(params.id);
    if (!order) return sendJson(res, 404, { error: 'Ordine non trovato.' });

    const wasPaid = order.payment_status === 'paid';
    const fields = {
      status: b.status ?? order.status,
      payment_status: b.payment_status ?? order.payment_status,
      tracking_number: b.tracking_number ?? order.tracking_number,
      carrier: b.carrier ?? order.carrier,
      notes: b.notes ?? order.notes
    };
    db.prepare('UPDATE orders SET status=?, payment_status=?, tracking_number=?, carrier=?, notes=? WHERE id=?')
      .run(fields.status, fields.payment_status, fields.tracking_number, fields.carrier, fields.notes, params.id);

    // Se l'admin conferma manualmente il pagamento ora, assegna le licenze/consegne digitali.
    if (!wasPaid && fields.payment_status === 'paid') {
      const { markOrderPaid } = require('./orders.routes');
      const freshOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(params.id);
      markOrderPaid(freshOrder);
    }

    auditLog(req.user.id, 'order.update', { id: params.id, ...fields });
    sendJson(res, 200, { ok: true });
  });

  router.post('/api/admin/orders/:id/refund', 'admin', async (req, res, params) => {
    db.prepare("UPDATE orders SET payment_status = 'refunded', status = 'refunded' WHERE id = ?").run(params.id);
    auditLog(req.user.id, 'order.refund', { id: params.id });
    sendJson(res, 200, { ok: true });
  });

  // ---------------- COUPON ----------------
  router.get('/api/admin/coupons', 'admin', async (req, res) => {
    sendJson(res, 200, { coupons: db.prepare('SELECT * FROM coupons ORDER BY id DESC').all() });
  });
  router.post('/api/admin/coupons', 'admin', async (req, res) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (!b.code || !b.type) return sendJson(res, 400, { error: 'Codice e tipo richiesti.' });
    try {
      const r = db.prepare(`INSERT INTO coupons (code, type, value, usage_limit, expires_at, min_order, max_order, status)
        VALUES (?,?,?,?,?,?,?,?)`)
        .run(b.code.toUpperCase(), b.type, b.value || 0, b.usage_limit || null, b.expires_at || null, b.min_order || null, b.max_order || null, b.status || 'active');
      sendJson(res, 201, { ok: true, id: r.lastInsertRowid });
    } catch { sendJson(res, 400, { error: 'Codice coupon gia esistente.' }); }
  });
  router.put('/api/admin/coupons/:id', 'admin', async (req, res, params) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    db.prepare('UPDATE coupons SET status=? WHERE id=?').run(b.status || 'active', params.id);
    sendJson(res, 200, { ok: true });
  });
  router.del('/api/admin/coupons/:id', 'admin', async (req, res, params) => {
    db.prepare('DELETE FROM coupons WHERE id = ?').run(params.id);
    sendJson(res, 200, { ok: true });
  });

  // ---------------- WALLET CRIPTO ----------------
  router.get('/api/admin/wallets', 'admin', async (req, res) => {
    sendJson(res, 200, { wallets: db.prepare('SELECT * FROM wallets ORDER BY id DESC').all() });
  });
  router.post('/api/admin/wallets', 'admin', async (req, res) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (!b.name || !b.network || !b.address) return sendJson(res, 400, { error: 'Nome, rete e indirizzo richiesti.' });
    const r = db.prepare(`INSERT INTO wallets (name, network, address, min_amount, max_amount, auto_verify, status)
      VALUES (?,?,?,?,?,?,?)`)
      .run(b.name, b.network, b.address, b.min_amount || 0, b.max_amount || null, b.auto_verify ? 1 : 0, b.status || 'active');
    auditLog(req.user.id, 'wallet.create', { id: r.lastInsertRowid, network: b.network });
    sendJson(res, 201, { ok: true, id: r.lastInsertRowid });
  });
  router.put('/api/admin/wallets/:id', 'admin', async (req, res, params) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const w = db.prepare('SELECT * FROM wallets WHERE id = ?').get(params.id);
    if (!w) return sendJson(res, 404, { error: 'Wallet non trovato.' });
    db.prepare('UPDATE wallets SET name=?, network=?, address=?, min_amount=?, max_amount=?, auto_verify=?, status=? WHERE id=?')
      .run(b.name ?? w.name, b.network ?? w.network, b.address ?? w.address, b.min_amount ?? w.min_amount,
        b.max_amount ?? w.max_amount, (b.auto_verify ?? w.auto_verify) ? 1 : 0, b.status ?? w.status, params.id);
    sendJson(res, 200, { ok: true });
  });
  router.del('/api/admin/wallets/:id', 'admin', async (req, res, params) => {
    db.prepare('DELETE FROM wallets WHERE id = ?').run(params.id);
    sendJson(res, 200, { ok: true });
  });

  // ---------------- PAYMENT GATEWAYS ----------------
  router.get('/api/admin/gateways', 'admin', async (req, res) => {
    const stripeApi = require('../integrations/stripe');
    const paypalApi = require('../integrations/paypal');
    const revolutApi = require('../integrations/revolut');
    const CONFIGURED = { stripe: stripeApi.isConfigured(), paypal: paypalApi.isConfigured(), revolut: revolutApi.isConfigured(), bank_transfer: !!process.env.BANK_IBAN, crypto_wallet: true, coinbase: false };
    const rows = db.prepare('SELECT id, code, name, status FROM payment_gateways ORDER BY id ASC').all();
    sendJson(res, 200, { gateways: rows.map(g => ({ ...g, configured: !!CONFIGURED[g.code] })) });
  });
  router.put('/api/admin/gateways/:id', 'admin', async (req, res, params) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const g = db.prepare('SELECT * FROM payment_gateways WHERE id = ?').get(params.id);
    if (!g) return sendJson(res, 404, { error: 'Gateway non trovato.' });
    db.prepare('UPDATE payment_gateways SET public_key=?, secret_key=?, status=? WHERE id=?')
      .run(b.public_key ?? g.public_key, b.secret_key ?? g.secret_key, b.status ?? g.status, params.id);
    auditLog(req.user.id, 'gateway.update', { code: g.code, status: b.status });
    sendJson(res, 200, { ok: true });
  });

  // ---------------- API PROVIDERS (consegna digitale automatica) ----------------
  router.get('/api/admin/api-providers', 'admin', async (req, res) => {
    const rows = db.prepare('SELECT id, name, endpoint, webhook_url, auth_method, rate_limit, status, created_at FROM api_providers ORDER BY id DESC').all();
    sendJson(res, 200, { providers: rows });
  });
  router.post('/api/admin/api-providers', 'admin', async (req, res) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (!b.name || !b.endpoint) return sendJson(res, 400, { error: 'Nome ed endpoint richiesti.' });
    const r = db.prepare(`INSERT INTO api_providers (name, api_key, api_secret, endpoint, webhook_url, auth_method, rate_limit, status)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(b.name, b.api_key || '', b.api_secret || '', b.endpoint, b.webhook_url || '', b.auth_method || 'bearer', b.rate_limit || 60, b.status || 'disabled');
    sendJson(res, 201, { ok: true, id: r.lastInsertRowid });
  });
  router.put('/api/admin/api-providers/:id', 'admin', async (req, res, params) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const p = db.prepare('SELECT * FROM api_providers WHERE id = ?').get(params.id);
    if (!p) return sendJson(res, 404, { error: 'Provider non trovato.' });
    db.prepare(`UPDATE api_providers SET name=?, api_key=?, api_secret=?, endpoint=?, webhook_url=?, auth_method=?, rate_limit=?, status=? WHERE id=?`)
      .run(b.name ?? p.name, b.api_key ?? p.api_key, b.api_secret ?? p.api_secret, b.endpoint ?? p.endpoint,
        b.webhook_url ?? p.webhook_url, b.auth_method ?? p.auth_method, b.rate_limit ?? p.rate_limit, b.status ?? p.status, params.id);
    sendJson(res, 200, { ok: true });
  });
  router.del('/api/admin/api-providers/:id', 'admin', async (req, res, params) => {
    db.prepare('DELETE FROM api_providers WHERE id = ?').run(params.id);
    sendJson(res, 200, { ok: true });
  });
  router.post('/api/admin/api-providers/:id/test', 'admin', async (req, res, params) => {
    const p = db.prepare('SELECT * FROM api_providers WHERE id = ?').get(params.id);
    if (!p) return sendJson(res, 404, { error: 'Provider non trovato.' });
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4000);
      await fetch(p.endpoint, { method: 'GET', signal: controller.signal });
      clearTimeout(t);
      sendJson(res, 200, { ok: true, message: 'Connessione riuscita.' });
    } catch (e) {
      sendJson(res, 200, { ok: false, message: 'Connessione non riuscita: nessuna rete in uscita in questo ambiente demo, oppure endpoint non raggiungibile. Il codice e pronto per un ambiente con accesso a internet.' });
    }
  });

  // ---------------- UTENTI ----------------
  router.get('/api/admin/users', 'admin', async (req, res) => {
    const rows = db.prepare('SELECT id, email, name, role, is_verified, wallet_balance, created_at FROM users ORDER BY created_at DESC').all();
    sendJson(res, 200, { users: rows });
  });
  router.put('/api/admin/users/:id/role', 'admin', async (req, res, params) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    if (!['admin', 'customer'].includes(b.role)) return sendJson(res, 400, { error: 'Ruolo non valido.' });
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(b.role, params.id);
    auditLog(req.user.id, 'user.role_change', { id: params.id, role: b.role });
    sendJson(res, 200, { ok: true });
  });
  router.post('/api/admin/users/:id/wallet-adjust', 'admin', async (req, res, params) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const amount = Number(b.amount);
    if (!amount) return sendJson(res, 400, { error: 'Importo non valido.' });
    db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(amount, params.id);
    db.prepare('INSERT INTO wallet_transactions (user_id, amount, type, reason) VALUES (?,?,?,?)')
      .run(params.id, amount, amount >= 0 ? 'credit' : 'debit', b.reason || 'Rettifica amministratore');
    sendJson(res, 200, { ok: true });
  });

  // ---------------- RECENSIONI ----------------
  router.get('/api/admin/reviews', 'admin', async (req, res) => {
    const rows = db.prepare(`SELECT r.*, p.title as product_title, u.name as user_name FROM reviews r
      JOIN products p ON p.id = r.product_id LEFT JOIN users u ON u.id = r.user_id ORDER BY r.created_at DESC`).all();
    sendJson(res, 200, { reviews: rows });
  });
  router.put('/api/admin/reviews/:id', 'admin', async (req, res, params) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    db.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(b.status, params.id);
    sendJson(res, 200, { ok: true });
  });

  // ---------------- TICKET SUPPORTO (vista admin) ----------------
  router.get('/api/admin/tickets', 'admin', async (req, res) => {
    const rows = db.prepare(`SELECT t.*, u.name as user_name, u.email as user_email FROM tickets t
      LEFT JOIN users u ON u.id = t.user_id ORDER BY t.created_at DESC`).all();
    sendJson(res, 200, { tickets: rows });
  });
  router.post('/api/admin/tickets/:id/reply', 'admin', async (req, res, params) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    db.prepare('INSERT INTO ticket_replies (ticket_id, sender_role, message) VALUES (?,?,?)').run(params.id, 'admin', b.message || '');
    db.prepare("UPDATE tickets SET status = ? WHERE id = ?").run(b.status || 'answered', params.id);
    sendJson(res, 200, { ok: true });
  });

  // ---------------- IMPOSTAZIONI ----------------
  router.get('/api/admin/settings', 'admin', async (req, res) => {
    const rows = db.prepare('SELECT * FROM settings').all();
    const obj = {}; rows.forEach(r => obj[r.key] = r.value);
    sendJson(res, 200, { settings: obj });
  });
  router.put('/api/admin/settings', 'admin', async (req, res) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    Object.entries(b).forEach(([k, v]) => setSetting(k, v));
    auditLog(req.user.id, 'settings.update', b);
    sendJson(res, 200, { ok: true });
  });

  // ---------------- UPLOAD IMMAGINI ----------------
  // Riceve un'immagine come dataURL base64 (niente multipart/form-data: nessuna libreria
  // esterna disponibile senza rete) e la salva in /public/uploads, restituendo l'URL pubblico.
  router.post('/api/admin/upload', 'admin', async (req, res) => {
    let b; try { b = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const dataUrl = b.data_url || '';
    const m = /^data:(image\/(png|jpeg|jpg|webp|gif));base64,(.+)$/.exec(dataUrl);
    if (!m) return sendJson(res, 400, { error: 'Formato immagine non valido. Usa PNG, JPG, WEBP o GIF.' });
    const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
    const buffer = Buffer.from(m[3], 'base64');
    if (buffer.length > 4 * 1024 * 1024) return sendJson(res, 400, { error: 'Immagine troppo grande (max 4MB).' });

    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, filename), buffer);

    auditLog(req.user.id, 'upload.image', { filename });
    sendJson(res, 201, { ok: true, url: `/uploads/${filename}` });
  });

  // ---------------- AUDIT LOG ----------------
  router.get('/api/admin/audit-logs', 'admin', async (req, res) => {
    const rows = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200').all();
    sendJson(res, 200, { logs: rows.map(r => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : null })) });
  });
}

module.exports = { register };