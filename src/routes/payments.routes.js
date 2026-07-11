'use strict';
const { db } = require('../db');
const { sendJson, readJsonBody } = require('../utils');

function register(router) {

  router.get('/api/payment-methods', 'public', async (req, res) => {
    const rows = db.prepare("SELECT code, name FROM payment_gateways WHERE status = 'enabled' ORDER BY id ASC").all();
    sendJson(res, 200, { methods: rows });
  });

  router.get('/api/wallets/public', 'public', async (req, res) => {
    const rows = db.prepare("SELECT id, name, network, address, min_amount, max_amount FROM wallets WHERE status = 'active' ORDER BY id ASC").all();
    sendJson(res, 200, { wallets: rows });
  });

  router.get('/api/payment-instructions/:orderNumber', 'any', async (req, res, params) => {
    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get(params.orderNumber);
    if (!order) return sendJson(res, 404, { error: 'Order not found.' });
    if (req.user && order.user_id && order.user_id !== req.user.id) {
      return sendJson(res, 403, { error: 'Unauthorized.' });
    }
    const instructions = buildInstructions(order);
    sendJson(res, 200, {
      order_number: order.order_number, total: order.total, currency: order.currency,
      payment_method: order.payment_method, payment_status: order.payment_status, instructions
    });
  });

  router.post('/api/coupons/preview', 'public', async (req, res) => {
    let body;
    try { body = await readJsonBody(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
    const { applyCoupon } = require('./orders.routes');
    const subtotal = Number(body.subtotal) || 0;
    const result = applyCoupon(body.code, subtotal);
    if (result.error) return sendJson(res, 400, { error: result.error });
    sendJson(res, 200, { discount: result.discount, free_shipping: result.freeShipping });
  });
}

function buildInstructions(order) {
  const { total, currency, order_number, payment_method } = order;

  if (payment_method === 'paypal_manual') {
    return {
      type: 'paypal',
      email: '32swaroski@gmail.com',
      amount: total,
      currency,
      order_number,
      steps: [
        'Send ' + total + ' ' + currency + ' via PayPal to:',
        '32swaroski@gmail.com',
        'Reference: ' + order_number,
        'After payment, send the receipt to support@fly.dev'
      ],
      note: 'Manual verification by staff. You will receive confirmation via email.'
    };
  }

  if (payment_method === 'revolut_manual') {
    return {
      type: 'revolut',
      link: 'https://revolut.me/exshop',
      revtag: '@exshop',
      amount: total,
      currency,
      order_number,
      steps: [
        'Click the link to pay:',
        'https://revolut.me/exshop',
        'Amount: ' + total + ' ' + currency,
        'Enter "' + order_number + '" in the description'
      ],
      note: 'Instant payment. Manual verification by staff.'
    };
  }

  if (payment_method === 'crypto_manual') {
    const wallet = db.prepare("SELECT * FROM wallets WHERE id = ?").get(order.wallet_id);
    if (!wallet) {
      return { type: 'crypto', error: 'Wallet not found.' };
    }
    return {
      type: 'crypto',
      network: wallet.network,
      address: wallet.address,
      amount_eur: total,
      currency,
      order_number,
      steps: [
        'Send the equivalent of ' + total + ' ' + currency + ' in ' + wallet.network + ' to:',
        'Address: ' + wallet.address,
        'Include "' + order_number + '" in the transaction if possible',
        'Or send the tx hash to support@fly.dev'
      ],
      note: 'Wait for confirmations on the ' + wallet.network + ' blockchain. Manual verification by staff.'
    };
  }

  return { type: payment_method, note: 'Unknown payment method.' };
}

module.exports = { register, buildInstructions };
