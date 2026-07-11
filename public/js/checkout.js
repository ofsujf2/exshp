// public/js/checkout.js — ExecutiveShop
(function () {
  var state = {
    step: 1,
    needsShipping: false,
    shipping: { line1: "", line2: "", city: "", state: "", postal_code: "", country: "IT" },
    guest_email: "",
    payment_method: null,
    wallet_id: null,
    wallets: [],
    methods: [],
    coupon_code: "",
    discount: 0,
    freeShipping: false,
    couponError: null
  };

  var PAY_ICONS = {
    paypal_manual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 4h7a4 4 0 0 1 4 4.6c-.5 3-2.9 4.9-6 4.9H9l-1.2 6.5"/><path d="M9.6 13.5H7"/></svg>',
    revolut_manual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 4h7a4.5 4.5 0 0 1 0 9H10l6 7"/><path d="M6 4v16"/></svg>',
    crypto_manual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9.5 8.5h3.2a2 2 0 0 1 0 4H9.5m0 0h3.6a2 2 0 0 1 0 4H9.5m2-9v1m0 8v1"/></svg>'
  };
  var PAY_LABELS = { paypal_manual: "PayPal", revolut_manual: "Revolut", crypto_manual: "Crypto" };
  var PAY_DESC = {
    paypal_manual: "You will receive the PayPal email to send the payment. Manual verification.",
    revolut_manual: "You will receive the Revolut link to pay. Instant transfer.",
    crypto_manual: "You will receive the wallet address. Choose BTC or LTC."
  };
  var NET_LABELS = { BTC: "Bitcoin", LTC: "Litecoin" };

  async function init() {
    var cartEl = document.getElementById("stepContent");
    if (!cartEl) return;
    if (ESH.cart.count() === 0) {
      cartEl.innerHTML = '<div class="glass checkout-panel text-center"><h3>Your cart is empty</h3><p class="text-muted mt-1">Add some products before checking out.</p><a href="/products.html" class="btn btn-primary mt-3">Browse products</a></div>';
      document.getElementById("summaryCard").innerHTML = "";
      return;
    }

    // Check if cart has physical items
    state.needsShipping = ESH.cart.hasPhysical();

    // Load payment methods and wallets
    try {
      var mRes = await ESH.api("/api/payment-methods");
      if (mRes.ok) state.methods = mRes.data.methods;
      console.log("Payment methods loaded:", state.methods);
    } catch(e) { console.error("Failed to load methods:", e); }

    try {
      var wRes = await ESH.api("/api/wallets/public");
      if (wRes.ok) state.wallets = wRes.data.wallets.filter(function(w) { return w.network === "BTC" || w.network === "LTC"; });
      console.log("Wallets loaded:", state.wallets);
    } catch(e) { console.error("Failed to load wallets:", e); }

    // Start at step 1 (cart)
    state.step = 1;
    render();
  }

  function renderSteps() {
    var steps = state.needsShipping ? ["Cart", "Shipping", "Payment"] : ["Cart", "Payment"];
    var html = '<div class="checkout-steps">';
    for (var i = 0; i < steps.length; i++) {
      var n = i + 1;
      var cls = n < state.step ? "done" : n === state.step ? "active" : "";
      html += '<div class="checkout-step ' + cls + '"><span class="num">' + (n < state.step ? "&#10003;" : n) + '</span>' + steps[i] + '</div>';
    }
    html += '</div>';
    return html;
  }

  function render() {
    document.querySelector(".checkout-steps-wrap").innerHTML = renderSteps();
    var content = document.getElementById("stepContent");
    var maxSteps = state.needsShipping ? 3 : 2;

    if (state.step === 1) {
      content.innerHTML = renderCart();
    } else if (state.needsShipping && state.step === 2) {
      content.innerHTML = renderShipping();
    } else {
      content.innerHTML = renderPayment();
    }
    renderSummary();
    bindEvents();
  }

  function renderCart() {
    var items = ESH.cart.get();
    var html = '<div class="glass checkout-panel"><h3>Your cart</h3>';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      html += '<div class="flex justify-between items-center" style="padding:0.8rem 0; border-bottom:1px solid var(--border-soft);"><div><div style="font-weight:600;">' + esc(it.title) + '</div><div class="text-muted" style="font-size:0.8rem;">' + (it.type === "digital" ? "Digital" : "Physical") + " &middot; " + ESH.formatPrice(it.price) + '</div></div><div class="flex items-center gap-1"><input type="number" min="1" value="' + it.qty + '" data-qty="' + it.product_id + '" style="width:60px; text-align:center; padding:0.4rem;"><button class="icon-btn" data-remove="' + it.product_id + '" title="Remove">&times;</button></div></div>';
    }
    html += '<div class="flex justify-between mt-2"><a href="/products.html" class="btn btn-ghost btn-sm">&larr; Continue shopping</a><button class="btn btn-primary" id="btnNext">Continue</button></div></div>';
    return html;
  }

  function renderShipping() {
    var s = state.shipping;
    var html = '<div class="glass checkout-panel"><h3>Shipping address</h3>';
    if (!window.__eshUser) {
      html += '<div class="field"><label>Email (guest checkout)</label><input id="guestEmail" type="email" placeholder="you@email.com" value="' + esc(state.guest_email) + '"></div>';
    }
    html += '<div class="form-row"><div class="field"><label>Address *</label><input id="line1" value="' + esc(s.line1) + '" placeholder="123 Main St"></div><div class="field"><label>Apt / Suite</label><input id="line2" value="' + esc(s.line2) + '"></div></div>';
    html += '<div class="form-row"><div class="field"><label>City *</label><input id="city" value="' + esc(s.city) + '"></div><div class="field"><label>State</label><input id="state" value="' + esc(s.state) + '"></div></div>';
    html += '<div class="form-row"><div class="field"><label>Postal code *</label><input id="postal_code" value="' + esc(s.postal_code) + '"></div><div class="field"><label>Country</label><input id="country" value="' + esc(s.country) + '"></div></div>';
    html += '<div class="flex justify-between mt-2"><button class="btn btn-ghost btn-sm" id="btnBack">&larr; Back</button><button class="btn btn-primary" id="btnNext">Continue to payment</button></div></div>';
    return html;
  }

  function renderPayment() {
    var options = [];
    var allOpts = ["paypal_manual", "revolut_manual", "crypto_manual"];
    for (var i = 0; i < allOpts.length; i++) {
      for (var j = 0; j < state.methods.length; j++) {
        if (state.methods[j].code === allOpts[i]) {
          options.push(allOpts[i]);
          break;
        }
      }
    }

    // FALLBACK: se methods non caricati, mostrali comunque
    if (options.length === 0) {
      options = ["paypal_manual", "revolut_manual", "crypto_manual"];
    }

    var detail = "";
    if (state.payment_method === "crypto_manual") {
      detail = '<div class="wallet-options">';
      for (var i = 0; i < state.wallets.length; i++) {
        var w = state.wallets[i];
        detail += '<div class="wallet-option ' + (state.wallet_id === w.id ? "selected" : "") + '" data-wallet="' + w.id + '"><div><strong>' + (NET_LABELS[w.network] || w.network) + '</strong><div class="net">Min. ' + ESH.formatPrice(w.min_amount) + '</div></div><span class="badge badge-blue">' + w.network + '</span></div>';
      }
      if (state.wallets.length === 0) {
        detail += '<p class="text-muted">No wallets configured. Contact support.</p>';
      }
      detail += '</div>';
    } else if (state.payment_method) {
      detail = '<div class="pay-detail">' + (PAY_DESC[state.payment_method] || "") + '</div>';
    }

    var html = '<div class="glass checkout-panel"><h3>Payment method</h3><p class="text-muted mb-1" style="font-size:0.85rem;">All payments are manually verified by staff.</p><div class="pay-methods">';
    for (var i = 0; i < options.length; i++) {
      var code = options[i];
      html += '<div class="pay-method ' + (state.payment_method === code ? "selected" : "") + '" data-method="' + code + '">' + (PAY_ICONS[code] || "") + '<span>' + (PAY_LABELS[code] || code) + '</span>' + (code === "crypto_manual" ? "<small>BTC &middot; LTC</small>" : "") + '</div>';
    }
    html += '</div><div id="payDetail">' + detail + '</div>';

    html += '<div class="mt-2"><div class="coupon-row"><input id="couponInput" placeholder="Discount code" value="' + esc(state.coupon_code) + '"><button class="btn btn-ghost" id="applyCoupon">Apply</button></div>';
    if (state.couponError) html += '<div class="alert alert-danger mt-1">' + state.couponError + '</div>';
    if (state.discount > 0) html += '<div class="alert alert-success mt-1">Discount: -' + ESH.formatPrice(state.discount) + '</div>';
    html += '</div>';

    html += '<div class="flex justify-between mt-3"><button class="btn btn-ghost btn-sm" id="btnBack">&larr; Back</button><button class="btn btn-primary" id="confirmOrder" ' + (state.payment_method ? "" : "disabled") + '>Confirm & pay</button></div></div>';
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
    for (var i = 0; i < items.length; i++) {
      html += '<div class="summary-line-item"><span>' + items[i].qty + "&times; " + esc(items[i].title) + '</span><span>' + ESH.formatPrice(items[i].price * items[i].qty) + '</span></div>';
    }
    html += '</div><div class="summary-item"><span>Subtotal</span><span>' + ESH.formatPrice(subtotal) + '</span></div>';
    if (state.discount > 0) html += '<div class="summary-item"><span>Discount</span><span>-' + ESH.formatPrice(state.discount) + '</span></div>';
    html += '<div class="summary-item"><span>Shipping</span><span>' + (shippingCost ? ESH.formatPrice(shippingCost) : "Free") + '</span></div>';
    html += '<div class="summary-item"><span>VAT (22%)</span><span>' + ESH.formatPrice(tax) + '</span></div>';
    html += '<div class="summary-item total"><span>Total</span><span>' + ESH.formatPrice(total) + '</span></div>';
    html += '<div class="trust-row">Secure payment &mdash; Manual verification</div></div>';
    document.getElementById("summaryCard").innerHTML = html;
  }

  function bindEvents() {
    document.querySelectorAll("[data-qty]").forEach(function(el) {
      el.onchange = function() {
        ESH.cart.updateQty(Number(this.dataset.qty), Number(this.value));
        state.needsShipping = ESH.cart.hasPhysical();
        render();
      };
    });
    document.querySelectorAll("[data-remove]").forEach(function(el) {
      el.onclick = function() {
        ESH.cart.remove(Number(this.dataset.remove));
        state.needsShipping = ESH.cart.hasPhysical();
        if (ESH.cart.count() === 0) return init();
        render();
      };
    });

    var btnNext = document.getElementById("btnNext");
    if (btnNext) {
      btnNext.onclick = function() {
        var maxSteps = state.needsShipping ? 3 : 2;
        if (state.step === 1 && state.needsShipping) {
          state.step = 2;
        } else if (state.step === 2 && state.needsShipping) {
          state.shipping = {
            line1: val("line1"), line2: val("line2"), city: val("city"),
            state: val("state"), postal_code: val("postal_code"), country: val("country")
          };
          var em = document.getElementById("guestEmail");
          if (em) state.guest_email = em.value;
          if (!state.shipping.line1 || !state.shipping.city || !state.shipping.postal_code) {
            ESH.toast("Please fill in all required fields.", "error");
            return;
          }
          state.step = maxSteps;
        } else if (state.step === 1 && !state.needsShipping) {
          state.step = maxSteps;
        }
        render();
      };
    }

    var btnBack = document.getElementById("btnBack");
    if (btnBack) {
      btnBack.onclick = function() {
        state.step = Math.max(1, state.step - 1);
        render();
      };
    }

    document.querySelectorAll("[data-method]").forEach(function(el) {
      el.onclick = function() {
        state.payment_method = this.dataset.method;
        state.wallet_id = null;
        render();
      };
    });

    document.querySelectorAll("[data-wallet]").forEach(function(el) {
      el.onclick = function() {
        state.wallet_id = Number(this.dataset.wallet);
        render();
      };
    });

    var applyBtn = document.getElementById("applyCoupon");
    if (applyBtn) {
      applyBtn.onclick = async function() {
        var code = document.getElementById("couponInput").value.trim();
        state.coupon_code = code;
        if (!code) { state.discount = 0; state.freeShipping = false; state.couponError = null; return render(); }
        var r = await ESH.api("/api/coupons/preview", { method: "POST", body: { code: code, subtotal: ESH.cart.subtotal() } });
        if (!r.ok) { state.discount = 0; state.freeShipping = false; state.couponError = r.error; }
        else { state.discount = r.data.discount; state.freeShipping = r.data.free_shipping; state.couponError = null; }
        render();
      };
    }

    var confirmBtn = document.getElementById("confirmOrder");
    if (confirmBtn) confirmBtn.onclick = submitOrder;
  }

  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }

  async function submitOrder() {
    if (state.payment_method === "crypto_manual" && !state.wallet_id) {
      return ESH.toast("Please select a cryptocurrency.", "error");
    }
    var btn = document.getElementById("confirmOrder");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Processing...';

    var items = ESH.cart.get().map(function(i) { return { product_id: i.product_id, quantity: i.qty }; });
    var payload = {
      items: items,
      payment_method: state.payment_method,
      wallet_id: state.payment_method === "crypto_manual" ? state.wallet_id : null,
      coupon_code: state.coupon_code || null,
      guest_email: state.guest_email || undefined,
      shipping_address: state.needsShipping ? state.shipping : undefined
    };
    var r = await ESH.api("/api/checkout", { method: "POST", body: payload });
    if (!r.ok) {
      ESH.toast(r.error, "error");
      btn.disabled = false;
      btn.textContent = "Confirm & pay";
      return;
    }
    ESH.cart.clear();
    renderSuccess(r.data);
  }

  function renderSuccess(data) {
    var o = data.order;
    var pi = data.payment_instructions;
    var block = "";
    if (pi.type === "paypal") {
      block = '<div class="glass" style="padding:1.5rem; text-align:left; margin-top:1.5rem;"><strong>PayPal</strong><div style="background:var(--panel); border-radius:10px; padding:1rem; margin-top:0.5rem;"><div>Send <strong>' + ESH.formatPrice(pi.amount) + '</strong> to:</div><code style="color:var(--blue-2);">' + esc(pi.email) + '</code><div style="margin-top:0.5rem; font-size:0.85rem; color:var(--muted);">Reference: <strong>' + esc(pi.order_number) + '</strong></div></div><p style="margin-top:0.6rem; font-size:0.8rem; color:var(--muted-2);">' + esc(pi.note) + '</p></div>';
    } else if (pi.type === "revolut") {
      block = '<div class="glass" style="padding:1.5rem; text-align:left; margin-top:1.5rem;"><strong>Revolut</strong><div style="background:var(--panel); border-radius:10px; padding:1rem; margin-top:0.5rem;"><div>Pay <strong>' + ESH.formatPrice(pi.amount) + '</strong>:</div><a href="' + esc(pi.link) + '" target="_blank" style="display:inline-block; margin:0.5rem 0; padding:0.6rem 1.2rem; background:var(--blue); color:#fff; border-radius:8px; font-weight:600;">Open Revolut</a><div style="font-size:0.85rem; color:var(--muted);">Ref: <strong>' + esc(pi.order_number) + '</strong></div></div><p style="margin-top:0.6rem; font-size:0.8rem; color:var(--muted-2);">' + esc(pi.note) + '</p></div>';
    } else if (pi.type === "crypto") {
      block = '<div class="glass" style="padding:1.5rem; text-align:left; margin-top:1.5rem;"><strong>' + esc(pi.network) + '</strong><div style="background:#0a0c10; border:1px solid var(--border); border-radius:10px; padding:1rem; margin-top:0.5rem;"><div style="font-size:0.85rem;">Send <strong>' + ESH.formatPrice(pi.amount_eur) + '</strong> to:</div><code style="display:block; padding:0.6rem; background:rgba(0,0,0,0.3); border-radius:8px; color:var(--blue-2); word-break:break-all; font-size:0.8rem; margin-top:0.5rem;">' + esc(pi.address) + '</code><div style="margin-top:0.5rem; font-size:0.85rem; color:var(--muted);">Order: <strong>' + esc(pi.order_number) + '</strong></div></div><p style="margin-top:0.6rem; font-size:0.8rem; color:var(--muted-2);">' + esc(pi.note) + '</p></div>';
    } else {
      block = '<div class="glass" style="padding:1.5rem; margin-top:1.5rem; text-align:center;">' + esc(pi.note || "") + '</div>';
    }

    document.querySelector(".checkout-steps-wrap").innerHTML = "";
    document.getElementById("stepContent").innerHTML = '<div class="glass checkout-panel success-screen"><div class="success-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg></div><h2>Order received</h2><p style="color:var(--muted);">Order: <strong>' + esc(o.order_number) + '</strong></p><span class="badge badge-warning">Awaiting verification</span>' + block + '<div style="margin-top:1.5rem; display:flex; gap:0.8rem; justify-content:center;"><a href="/dashboard.html" class="btn btn-primary">My orders</a><a href="/products.html" class="btn btn-ghost">Continue shopping</a></div></div>';
    document.getElementById("summaryCard").innerHTML = "";
  }

  function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  window.addEventListener("DOMContentLoaded", init);
})();
