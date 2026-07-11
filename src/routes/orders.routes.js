'use strict';
const { db } = require('../db');
const { sendJson, readJsonBody, orderNumber, auditLog } = require('../utils');

function applyCoupon(code, subtotal) {
  if (!code) return { discount: 0, freeShipping: false, error: null };
  const c = db.prepare("SELECT * FROM coupons WHERE code = ? AND status = 'active'").get(code.toUpperCase());
  if (!c) return { discount: 0, freeShipping: false, error: 'Invalid or expired coupon.' };
  if (c.expires_at && new Date(c.expires_at) < new Date()) return { discount: 0, freeShipping: false, error: 'Coupon expired.' };
  if (c.usage_limit && c.used_count >= c.usage_limit) return { discount: 0, freeShipping: false, error: 'Coupon limit reached.' };
  if (c.min_order && subtotal < c.min_order) return { discount: 0, freeShipping: false, error: `Minimum order: ${c.min_order} EUR.` };
  if (c.max_order && subtotal > c.max_order) return { discount: 0, freeShipping: false, error: `Maximum order: ${c.max_order} EUR.` };

  if (c.type === 'percentage') return { discount: +(subtotal * c.value / 100).toFixed(2), freeShipping: false, error: null, id: c.id };
  if (c.type === 'fixed') return { discount: Math.min(c.value, subtotal), freeShipping: false, error: null, id: c.id };
  if (c.type === 'free_shipping') return { discount: 0, freeShipping: true, error: null, id: c.id };
  return { discount: 0, freeShipping: false, error: null };
}

function fulfillDigitalItem(product, order) {
  if (product.delivery_type === 'license_key') {
    const key = db.prepare("SELECT * FROM license_keys WHERE product_id = ? AND status = 'available' LIMIT 1").get(product.id);
    if (!key) return { ok: false, message: 'No licenses available.' };
    db.prepare("UPDATE license_keys SET status = 'used', order_id = ? WHERE id = ?").run(order.id, key.id);
    return { ok: true, type: 'license_key', value: key.key_value };
  }
  if (product.delivery_type === 'file') {
    return { ok: true, type: 'file', value: product.digital_file_url || null };
  }
  return { ok: false, message: 'Delivery not available.' };
}

const VALID_PAYMENT_METHODS = ['paypal_manual', 'revolut_manual', 'crypto_manual'];

function register(router) {

  router.post('/api/checkout', 'any', async (req, res) => {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }

    const { items, payment_method, wallet_id, coupon_code, shipping_address, guest_email } = body;

    if (!Array.isArray(items) || items.length === 0) return sendJson(res, 400, { error: 'Cart is empty.' });
    if (!req.user && !guest_email) return sendJson(res, 400, { error: 'Email required for guest checkout.' });

    let subtotal = 0;
    let hasPhysical = false;
    const resolvedItems = [];

    for (const it of items) {
      const p = db.prepare("SELECT * FROM products WHERE id = ? AND status = 'published'").get(it.product_id);
      if (!p) return sendJson(res, 400, { error: `Product ${it.product_id} not available.` });
      const qty = Math.max(1, Number(it.quantity) || 1);

      if (p.type === 'physical') {
        hasPhysical = true;
        if (!p.unlimited_stock && p.stock < qty) {
          return sendJson(res, 409, { error: `Insufficient stock for "${p.title}" (available: ${p.stock}).` });
        }
      }

      const unitPrice = p.discount_price != null ? p.discount_price : p.price;
      subtotal += unitPrice * qty;
      resolvedItems.push({ product: p, qty, unitPrice });
    }
    subtotal = +subtotal.toFixed(2);

    const coupon = applyCoupon(coupon_code, subtotal);
    if (coupon.error) return sendJson(res, 400, { error: coupon.error });

    const shippingCost = (hasPhysical && !coupon.freeShipping) ? 6.9 : 0;
    const taxRate = 0.22;
    const taxableBase = subtotal - coupon.discount;
    const tax = +(taxableBase * taxRate).toFixed(2);
    const total = +(taxableBase + tax + shippingCost).toFixed(2);

    if (!VALID_PAYMENT_METHODS.includes(payment_method)) {
      return sendJson(res, 400, { error: 'Invalid payment method.' });
    }

    const gateway = db.prepare("SELECT * FROM payment_gateways WHERE code = ? AND status = 'enabled'").get(payment_method);
    if (!gateway) {
      return sendJson(res, 400, { error: 'Payment method not available.' });
    }

    let wallet = null;
    if (payment_method === 'crypto_manual') {
      wallet = db.prepare("SELECT * FROM wallets WHERE id = ? AND status = 'active'").get(wallet_id);
      if (!wallet) return sendJson(res, 400, { error: 'Select a valid crypto wallet (BTC or LTC).' });
      if (total < wallet.min_amount) {
        return sendJson(res, 400, { error: `Minimum amount for ${wallet.network}: ${wallet.min_amount} EUR.` });
      }
    }

    let addressId = null;
    if (hasPhysical) {
      if (!shipping_address) return sendJson(res, 400, { error: 'Shipping address required.' });
      const a = shipping_address;
      const r = db.prepare(`INSERT INTO addresses (user_id, label, line1, line2, city, state, postal_code, country)
        VALUES (?,?,?,?,?,?,?,?)`)
        .run(req.user ? req.user.id : 0, a.label || 'Shipping', a.line1, a.line2 || '', a.city, a.state || '', a.postal_code, a.country);
      addressId = r.lastInsertRowid;
    }

    const orderNo = orderNumber();
    const orderRes = db.prepare(`INSERT INTO orders
      (order_number, user_id, status, payment_status, payment_method, wallet_id,
       subtotal, discount, tax, shipping_cost, total, currency, coupon_code, shipping_address_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(
        orderNo, req.user ? req.user.id : null, 'pending', 'pending_verification',
        payment_method, wallet ? wallet.id : null, subtotal, coupon.discount, tax,
        shippingCost, total, 'EUR', coupon_code || null, addressId
      );
    const orderId = orderRes.lastInsertRowid;

    const itemStmt = db.prepare('INSERT INTO order_items (order_id, product_id, title, price, quantity, type) VALUES (?,?,?,?,?,?)');
    for (const ri of resolvedItems) {
      itemStmt.run(orderId, ri.product.id, ri.product.title, ri.unitPrice, ri.qty, ri.product.type);
      if (ri.product.type === 'physical' && !ri.product.unlimited_stock) {
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(ri.qty, ri.product.id);
      }
    }

    if (coupon.id) db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(coupon.id);
    auditLog(req.user ? req.user.id : null, 'order.created', { order_number: orderNo, total });

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const { buildInstructions } = require('./payments.routes');
    const paymentInstructions = buildInstructions(order);

    sendJson(res, 201, { ok: true, order: publicOrder(order), payment_instructions: paymentInstructions });
  });

  router.get('/api/my/orders', 'customer', async (req, res) => {
    const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    sendJson(res, 200, { orders: rows.map(publicOrder) });
  });

  router.get('/api/my/orders/:orderNumber', 'customer', async (req, res, params) => {
    const order = db.prepare('SELECT * FROM orders WHERE order_number = ? AND user_id = ?').get(params.orderNumber, req.user.id);
    if (!order) return sendJson(res, 404, { error: 'Order not found.' });

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    const deliveries = [];

    if (order.payment_status === 'paid') {
      for (const it of items) {
        const product = it.product_id ? db.prepare('SELECT * FROM products WHERE id = ?').get(it.product_id) : null;
        if (product && product.type === 'digital') {
          const existingKey = db.prepare("SELECT key_value FROM license_keys WHERE order_id = ? AND product_id = ?").get(order.id, product.id);
          if (existingKey) {
            deliveries.push({ product: product.title, type: 'license_key', value: existingKey.key_value });
          } else if (product.delivery_type === 'file') {
            deliveries.push({ product: product.title, type: 'file', value: product.digital_file_url });
          }
        }
      }
    }

    sendJson(res, 200, { order: publicOrder(order), items, deliveries });
  });
}

function publicOrder(o) {
  return {
    order_number: o.order_number,
    status: o.status,
    payment_status: o.payment_status,
    payment_method: o.payment_method,
    subtotal: o.subtotal,
    discount: o.discount,
    tax: o.tax,
    shipping_cost: o.shipping_cost,
    total: o.total,
    currency: o.currency,
    created_at: o.created_at
  };
}

module.exports = { register, fulfillDigitalItem, applyCoupon };