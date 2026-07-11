// public/js/checkout.js — ExecutiveShop
// Checkout with PayPal (email), Revolut (link pay), Crypto (BTC/LTC)
(function () {
  const state = {
    step: 1,
    needsShipping: false,
    shipping: { label: 'Home', line1: '', line2: '', city: '', state: '', postal_code: '', country: 'IT' },
    guest_email: '',
    payment_method: null,
    wallet_id: null,
    wallets: [],
    methods: [],
    coupon_code: '',
    discount: 0,
    freeShipping: false,
    couponError: null
  };

  const PAY_ICONS = {
    paypal_manual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 4h7a4 4 0 0 1 4 4.6c-.5 3-2.9 4.9-6 4.9H9l-1.2 6.5"/><path d="M9.6 13.5H7"/></svg>',
    revolut_manual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 4h7a4.5 4.5 0 0 1 0 9H10l6 7"/><path d="M6 4v16"/></svg>',
    crypto_manual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9.5 8.5h3.2a2 2 0 0 1 0 4H9.5m0 0h3.6a2 2 0 0 1 0 4H9.5m2-9v1m0 8v1"/></svg>'
  };

  const PAY_LABELS = {
    paypal_manual: 'PayPal',
    revolut_manual: 'Revolut',
    crypto_manual: 'Crypto'
  };

  const PAY_DESCRIPTIONS = {
    paypal_manual: 'You will receive the PayPal email address to send the payment. Manual verification by staff.',
    revolut_manual: 'You will receive the Revolut link to pay. Instant transfer.',
    crypto_manual: 'You will receive the wallet address. Choose BTC or LTC.'
  };

  const NET_LABELS = { BTC: 'Bitcoin', LTC: 'Litecoin' };

  async function init() {
    const cartEl = document.getElementById('stepContent');
    if (!cartEl) return;
    if (ESH.cart.count() === 0) {
      cartEl.innerHTML = '<div class="glass checkout-panel text-center"><h3>Your cart is empty</h3><p class="text-muted mt-1">Add some products before checking out.</p><a href="/products.html" class="btn btn-primary mt-3">Browse products</a></div>';
      document.getElementById('summaryCard').innerHTML = '';
      return;
    }
    // Determine if cart needs shipping
    state.needsShipping = ESH.cart.hasPhysical();
    const [methodsRes, walletsRes] = await Promise.all([ESH.api('/api/payment-methods'), ESH.api('/api/wallets/public')]);
    if (methodsRes.ok) state.methods = methodsRes.data.methods;
    if (walletsRes.ok) state.wallets = walletsRes.data.wallets.filter(function(w) { return w.network === 'BTC' || w.network === 'LTC'; });
    render();
  }

  function renderSteps() {
    var steps;
    if (state.needsShipping) {
      steps = ['Cart', 'Shipping', 'Payment'];
    } else {
      steps = ['Cart', 'Payment'];
    }
    return '<div class="checkout-steps">' + steps.map(function(s, i) {
      var n = i + 1;
      var cls = n < state.step ? 'done' : n === state.step ? 'active' : '';
      return '<div class="checkout-step ' + cls + '"><span class="num">' + (n < state.step ? '&#10003;' : n) + '</span>' + s + '</div>';
    }).join('') + '</div>';
  }

  function render() {
    document.querySelector('.checkout-steps-wrap').innerHTML = renderSteps();
    var content = document.getElementById('stepContent');
    var totalSteps = state.needsShipping ? 3 : 2;
    var shippingStep = state.needsShipping ? 2 : null;
    var paymentStep = totalSteps;

    if (state.step === 1) {
      content.innerHTML = renderCart();
    } else if (state.needsShipping && state.step === 2) {
      content.innerHTML = renderShipping();
    } else if (state.step === paymentStep) {
      content.innerHTML = renderPayment();
    }

    renderSummary();
    bindEvents(paymentStep);
  }

  function renderCart() {
    var items = ESH.cart.get();
    var html = '<div class="glass checkout-panel"><h3>Your cart</h3>';
    items.forEach(function(i) {
      html += '<div class="flex justify-between items-center gap-2 mt-1" style="padding:0.8rem 0; border-bottom:1px solid var(--border-soft);"><div><div style="font-weight:600;">' + escapeHtml(i.title) + '</div><div class="text-muted" style="font-size:0.8rem;">' + (i.type === 'digital' ? 'Digital item' : 'Physical product') + ' &middot; ' + ESH.formatPrice(i.price) + '</div></div><div class="flex items-center gap-1"><input type="number" min="1" value="' + i.qty + '" data-qty="' + i.product_id + '" style="width:64px; text-align:center; padding:0.5rem;"><button class="icon-btn" data-remove="' + i.product_id + '" title="Remove">&times;</button></div></div>';
    });
    html += '<div class="flex justify-between mt-2"><a href="/products.html" class="btn btn-ghost btn-sm">&larr; Continue shopping</a><button class="btn btn-primary" id="toStep2">Continue</button></div></div>';
    return html;
  }

  function renderShipping() {
    var s = state.shipping;
    var html = '<div class="glass checkout-panel"><h3>Shipping address</h3>';
    if (!window.__eshUser) {
      html += '<div class="field"><label>Email (guest checkout)</label><input id="guestEmail" type="email" placeholder="you@email.com" value="' + state.guest_email + '"></div>';
    }
    html += '<div class="form-row"><div class="field"><label>Address</label><input id="line1" value="' + s.line1 + '" placeholder="123 Main St"></div><div class="field"><label>Apt / Suite (optional)</label><input id="line2" value="' + s.line2 + '"></div></div><div class="form-row"><div class="field"><label>City</label><input id="city" value="' + s.city + '"></div><div class="field"><label>State / Province</label><input id="state" value="' + s.state + '"></div></div><div class="form-row"><div class="field"><label>Postal code</label><input id="postal_code" value="' + s.postal_code + '"></div><div class="field"><label>Country</label><input id="country" value="' + s.country + '"></div></div><div class="flex justify-between mt-2"><button class="btn btn-ghost btn-sm" id="backStep">&larr; Back</button><button class="btn btn-primary" id="toStep3">Continue to payment</button></div></div>';
    return html;
  }

  function renderPayment() {
    var enabledCodes = state.methods.map(function(m) { return m.code; });
    var allOptions = ['paypal_manual', 'revolut_manual', 'crypto_manual'];
    var options = allOptions.filter(function(c) { return enabledCodes.indexOf(c) !== -1; });

    var detail = '';
    if (state.payment_method === 'crypto_manual') {
      detail = '<div class="wallet-options">';
      state.wallets.forEach(function(w) {
        detail += '<div class="wallet-option ' + (state.wallet_id === w.id ? 'selected' : '') + '" data-wallet="' + w.id + '"><div><strong>' + (NET_LABELS[w.network] || w.network) + '</strong><div class="net">Min. ' + ESH.formatPrice(w.min_amount) + '</div></div><span class="badge badge-blue">' + w.network + '</span></div>';
      });
      detail += '</div><p class="text-muted mt-1" style="font-size:0.78rem;">Choose the cryptocurrency. You will get the wallet address after confirmation.</p>';
    } else if (state.payment_method) {
      detail = '<div class="pay-detail">' + PAY_DESCRIPTIONS[state.payment_method] + '</div>';
    }

    var html = '<div class="glass checkout-panel"><h3>Payment method</h3><p class="text-muted mb-1" style="font-size:0.85rem;">Choose how to pay. All payments are manually verified by staff.</p><div class="pay-methods">';
    options.forEach(function(code) {
      html += '<div class="pay-method ' + (state.payment_method === code ? 'selected' : '') + '" data-method="' + code + '">' + PAY_ICONS[code] + '<span>' + PAY_LABELS[code] + '</span>' + (code === 'crypto_manual' ? '<small>BTC &middot; LTC</small>' : '') + '</div>';
    });
    html += '</div><div id="payDetail">' + detail + '</div><div class="mt-2"><div class="coupon-row"><input id="couponInput" placeholder="Discount code" value="' + state.coupon_code + '"><button class="btn btn-ghost" id="applyCoupon">Apply</button></div>' + (state.couponError ? '<div class="alert alert-danger mt-1">' + state.couponError + '</div>' : '') + (state.discount > 0 ? '<div class="alert alert-success mt-1">Discount applied: -' + ESH.formatPrice(state.discount) + '</div>' : '') + '</div><div class="flex justify-between mt-3"><button class="btn btn-ghost btn-sm" id="backStep">&larr; Back</button><button class="btn btn-primary" id="confirmOrder" ' + (state.payment_method ? '' : 'disabled') + '>Confirm & pay</button></div></div>';
    return html;
  }

  function renderSummary() {
    var items = ESH.cart.get();
    var subtotal = ESH.cart.subtotal();
    var shippingCost = (state.needsShipping && !state.freeShipping) ? 6.9 : 0;
    var taxable = subtotal - state.discount;
    var tax = +(taxable * 0.22).toFixed(2);
    var total = +(taxable + tax + shippingCost).toFixed(2);
    var html = '<div class="glass summary-card"><h3 class="mb-2">Order summary</h3><div class="summary-line-items">';
    items.forEach(function(i) {
      html += '<div class="summary-line-item"><span>' + i.qty + '&times; ' + escapeHtml(i.title) + '</span><span>' + ESH.formatPrice(i.price * i.qty) + '</span></div>';
    });
    html += '</div><div class="summary-item"><span>Subtotal</span><span>' + ESH.formatPrice(subtotal) + '</span></div>' + (state.discount > 0 ? '<div class="summary-item"><span>Discount</span><span>-' + ESH.formatPrice(state.discount) + '</span></div>' : '') + '<div class="summary-item"><span>Shipping</span><span>' + (shippingCost ? ESH.formatPrice(shippingCost) : 'Free') + '</span></div><div class="summary-item"><span>VAT (22%)</span><span>' + ESH.formatPrice(tax) + '</span></div><div class="summary-item total"><span>Total</span><span>' + ESH.formatPrice(total) + '</span></div><div class="trust-row">Secure payment &mdash; Manual staff verification</div></div>';
    document.getElementById('summaryCard').innerHTML = html;
  }

  function bindEvents(paymentStep) {
    document.querySelectorAll('[data-qty]').forEach(function(inp) {
      inp.addEventListener('change', function() {
        ESH.cart.updateQty(Number(inp.dataset.qty), Number(inp.value));
        state.needsShipping = ESH.cart.hasPhysical();
        render();
      });
    });
    document.querySelectorAll('[data-remove]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        ESH.cart.remove(Number(btn.dataset.remove));
        state.needsShipping = ESH.cart.hasPhysical();
        if (ESH.cart.count() === 0) return init();
        render();
      });
    });

    var toStep2 = document.getElementById('toStep2');
    if (toStep2) toStep2.addEventListener('click', function() {
      if (state.needsShipping) {
        state.step = 2;
      } else {
        state.step = paymentStep;
      }
      render();
    });

    var backStep = document.getElementById('backStep');
    if (backStep) backStep.addEventListener('click', function() {
      state.step = Math.max(1, state.step - 1);
      render();
    });

    var toStep3 = document.getElementById('toStep3');
    if (toStep3) toStep3.addEventListener('click', function() {
      state.shipping = {
        label: 'Home',
        line1: val('line1'), line2: val('line2'), city: val('city'),
        state: val('state'), postal_code: val('postal_code'), country: val('country')
      };
      var emailInput = document.getElementById('guestEmail');
      if (emailInput) state.guest_email = emailInput.value;
      if (!state.shipping.line1 || !state.shipping.city || !state.shipping.postal_code) {
        ESH.toast('Please fill in all required address fields.', 'error'); return;
      }
      state.step = paymentStep; render();
    });

    document.querySelectorAll('[data-method]').forEach(function(el) {
      el.addEventListener('click', function() { state.payment_method = el.dataset.method; state.wallet_id = null; render(); });
    });
    document.querySelectorAll('[data-wallet]').forEach(function(el) {
      el.addEventListener('click', function() { state.wallet_id = Number(el.dataset.wallet); render(); });
    });

    var applyCoupon = document.getElementById('applyCoupon');
    if (applyCoupon) applyCoupon.addEventListener('click', async function() {
      var code = document.getElementById('couponInput').value.trim();
      state.coupon_code = code;
      if (!code) { state.discount = 0; state.freeShipping = false; state.couponError = null; return render(); }
      var r = await ESH.api('/api/coupons/preview', { method: 'POST', body: { code: code, subtotal: ESH.cart.subtotal() } });
      if (!r.ok) { state.discount = 0; state.freeShipping = false; state.couponError = r.error; }
      else { state.discount = r.data.discount; state.freeShipping = r.data.free_shipping; state.couponError = null; }
      render();
    });

    var confirmBtn = document.getElementById('confirmOrder');
    if (confirmBtn) confirmBtn.addEventListener('click', submitOrder);
  }

  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  async function submitOrder() {
    if (state.payment_method === 'crypto_manual' && !state.wallet_id) {
      return ESH.toast('Please select a cryptocurrency (BTC or LTC).', 'error');
    }
    var btn = document.getElementById('confirmOrder');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Processing...';

    var items = ESH.cart.get().map(function(i) { return { product_id: i.product_id, quantity: i.qty }; });
    var payload = {
      items: items,
      payment_method: state.payment_method,
      wallet_id: state.payment_method === 'crypto_manual' ? state.wallet_id : null,
      coupon_code: state.coupon_code || null,
      guest_email: state.guest_email || undefined,
      shipping_address: state.needsShipping ? state.shipping : undefined
    };
    var r = await ESH.api('/api/checkout', { method: 'POST', body: payload });
    if (!r.ok) {
      ESH.toast(r.error, 'error');
      btn.disabled = false; btn.textContent = 'Confirm & pay';
      return;
    }
    ESH.cart.clear();
    renderSuccess(r.data);
  }

  function renderSuccess(data) {
    var order = data.order;
    var pi = data.payment_instructions;
    var methodBlock = '';

    if (pi.type === 'paypal') {
      methodBlock = '<div class="glass" style="padding:1.5rem; text-align:left; margin-top:1.5rem;"><div style="display:flex; align-items:center; gap:0.7rem; margin-bottom:1rem;"><span style="font-size:1.6rem;">P</span><strong style="font-size:1.1rem;">PayPal</strong></div><div style="background:var(--panel); border-radius:10px; padding:1rem;"><div style="margin-bottom:0.5rem;">Send <strong>' + ESH.formatPrice(pi.amount) + '</strong> to:</div><code style="font-size:1rem; color:var(--blue-2); word-break:break-all;">' + escapeHtml(pi.email) + '</code><div style="margin-top:0.8rem; font-size:0.85rem; color:var(--muted);">Reference: <strong>' + escapeHtml(pi.order_number) + '</strong></div></div><p style="margin-top:0.8rem; font-size:0.8rem; color:var(--muted-2);">' + escapeHtml(pi.note) + '</p></div>';
    } else if (pi.type === 'revolut') {
      methodBlock = '<div class="glass" style="padding:1.5rem; text-align:left; margin-top:1.5rem;"><div style="display:flex; align-items:center; gap:0.7rem; margin-bottom:1rem;"><span style="font-size:1.6rem;">R</span><strong style="font-size:1.1rem;">Revolut</strong></div><div style="background:var(--panel); border-radius:10px; padding:1rem;"><div style="margin-bottom:0.5rem;">Pay <strong>' + ESH.formatPrice(pi.amount) + '</strong> via:</div><a href="' + escapeHtml(pi.link) + '" target="_blank" rel="noopener" style="display:inline-block; margin:0.5rem 0; padding:0.6rem 1.2rem; background:var(--blue); color:#fff; border-radius:8px; font-weight:600; font-size:0.9rem;">Open Revolut</a><div style="margin-top:0.8rem; font-size:0.85rem; color:var(--muted);">Description: <strong>' + escapeHtml(pi.order_number) + '</strong></div></div><p style="margin-top:0.8rem; font-size:0.8rem; color:var(--muted-2);">' + escapeHtml(pi.note) + '</p></div>';
    } else if (pi.type === 'crypto') {
      methodBlock = '<div class="glass" style="padding:1.5rem; text-align:left; margin-top:1.5rem;"><div style="display:flex; align-items:center; gap:0.7rem; margin-bottom:1rem;"><span style="font-size:1.6rem;">B</span><strong style="font-size:1.1rem;">' + escapeHtml(pi.network) + '</strong></div><div style="background:#0a0c10; border:1px solid var(--border); border-radius:10px; padding:1rem;"><div style="margin-bottom:0.5rem; font-size:0.8rem; color:var(--muted);">Send <strong>' + ESH.formatPrice(pi.amount_eur) + '</strong> to this address:</div><code style="display:block; padding:0.7rem; background:rgba(0,0,0,0.3); border-radius:8px; color:var(--blue-2); word-break:break-all; font-size:0.8rem;">' + escapeHtml(pi.address) + '</code><div style="margin-top:0.8rem; font-size:0.85rem; color:var(--muted);">Order: <strong>' + escapeHtml(pi.order_number) + '</strong></div></div><p style="margin-top:0.8rem; font-size:0.8rem; color:var(--muted-2);">' + escapeHtml(pi.note) + '</p></div>';
    } else {
      methodBlock = '<div class="glass" style="padding:1.5rem; margin-top:1.5rem; text-align:center; color:var(--muted);">' + escapeHtml(pi.note || '') + '</div>';
    }

    document.querySelector('.checkout-steps-wrap').innerHTML = '';
    document.getElementById('stepContent').innerHTML = '<div class="glass checkout-panel success-screen"><div class="success-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg></div><h2>Order received</h2><p style="color:var(--muted); margin-top:0.3rem;">Order number: <strong>' + escapeHtml(order.order_number) + '</strong></p><span class="badge badge-warning" style="margin-top:0.5rem;">Awaiting payment verification</span>' + methodBlock + '<div style="margin-top:1.5rem; display:flex; gap:0.8rem; justify-content:center; flex-wrap:wrap;"><a href="/dashboard.html" class="btn btn-primary">My orders</a><a href="/products.html" class="btn btn-ghost">Continue shopping</a></div></div>';
    document.getElementById('summaryCard').innerHTML = '';
  }

  function escapeHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  window.addEventListener('DOMContentLoaded', init);
})();
