// public/js/checkout.js — ExecutiveShop
(function () {
  var state = {
    step: 1,
    needsShipping: false,
    shipping: { label: "Home", line1: "", line2: "", city: "", state: "", postal_code: "", country: "IT" },
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
  var PAY_DESCRIPTIONS = {
    paypal_manual: "You will receive the PayPal email to send the payment. Manual verification by staff.",
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
    state.needsShipping = ESH.cart.hasPhysical();
    var results = await Promise.all([ESH.api("/api/payment-methods"), ESH.api("/api/wallets/public")]);
    if (results[0].ok) state.methods = results[0].data.methods;
    if (results[1].ok) state.wallets = results[1].data.wallets.filter(function(w) { return w.network === "BTC" || w.network === "LTC"; });
    render();
  }

  function totalSteps() {
    return state.needsShipping ? 3 : 2;
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
      html += '<div class="flex justify-between items-center gap-2" style="padding:0.8rem 0; border-bottom:1px solid var(--border-soft);"><div><div style="font-weight:600;">' + escapeHtml(items[i].title) + '</div><div class="text-muted" style="font-size:0.8rem;">' + (items[i].type === "digital" ? "Digital item" : "Physical product") + " &middot; " + ESH.formatPrice(items[i].price) + '</div></div><div class="flex items-center gap-1"><input type="number" min="1" value="' + items[i].qty + '" data-qty="' + items[i].product_id + '" style="width:64px; text-align:center; padding:0.5rem;"><button class="icon-btn" data-remove="' + items[i].product_id + '" title="Remove">&times;</button></div></div>';
    }
    html += '<div class="flex justify-between mt-2"><a href="/products.html" class="btn btn-ghost btn-sm">&larr; Continue shopping</a><button class="btn btn-primary" id="btnNext">Continue</button></div></div>';
    return html;
  }

  function renderShipping() {
    var s = state.shipping;
    var html = '<div class="glass checkout-panel"><h3>Shipping address</h3>';
    if (!window.__eshUser) {
      html += '<div class="field"><label>Email (guest checkout)</label><input id="guestEmail" type="email" placeholder="you@email.com" value="' + escapeHtml(state.guest_email) + '"></div>';
    }
    html += '<div class="form-row"><div class="field"><label>Address *</label><input id="line1" value="' + escapeHtml(s.line1) + '" placeholder="123 Main St"></div><div class="field"><label>Apt / Suite (optional)</label><input id="line2" value="' + escapeHtml(s.line2) + '"></div></div>';
    html += '<div class="form-row"><div class="field"><label>City *</label><input id="city" value="' + escapeHtml(s.city) + '"></div><div class="field"><label>State / Province</label><input id="state" value="' + escapeHtml(s.state) + '"></div></div>';
    html += '<div class="form-row"><div class="field"><label>Postal code *</label><input id="postal_code" value="' + escapeHtml(s.postal_code) + '"></div><div class="field"><label>Country</label><input id="country" value="' + escapeHtml(s.country) + '"></div></div>';
    html += '<div class="flex justify-between mt-2"><button class="btn btn-ghost btn-sm" id="btnBack">&larr; Back</button><button class="btn btn-primary" id="btnNext">Continue to payment</button></div></div>';
    return html;
  }

  function renderPayment() {
    var enabledCodes = state.methods.map(function(m) { return m.code; });
    var allOptions = ["paypal_manual", "revolut_manual", "crypto_manual"];
    var options = [];
    for (var i = 0; i < allOptions.length; i++) {
      if (enabledCodes.indexOf(allOptions[i]) !== -1) options.push(allOptions[i]);
    }

    var detail = "";
    if (state.payment_method === "crypto_manual") {
      detail = '<div class="wallet-options">';
      for (var i = 0; i < state.wallets.length; i++) {
        var w = state.wallets[i];
        detail += '<div class="wallet-option ' + (state.wallet_id === w.id ? "selected" : "") + '" data-wallet="' + w.id + '"><div><strong>' + (NET_LABELS[w.network] || w.network) + '</strong><div class="net">Min. ' + ESH.formatPrice(w.min_amount) + '</div></div><span class="badge badge-blue">' + w.network + '</span></div>';
      }
      detail += '</div><p class="text-muted mt-1" style="font-size:0.78rem;">Choose the cryptocurrency. You will receive the wallet address after confirmation.</p>';
    } else if (state.payment_method) {
      detail = '<div class="pay-detail">' + PAY_DESCRIPTIONS[state.payment_method] + '</div>';
    }

    var html = '<div class="glass checkout-panel"><h3>Payment method</h3><p class="text-muted mb-1" style="font-size:0.85rem;">Choose how to pay. All payments are manually verified by staff.</p><div class="pay-methods">';
    for (var i = 0; i < options.length; i++) {
      var code = options[i];
      html += '<div class="pay-method ' + (state.payment_method === code ? "selected" : "") + '" data-method="' + code + '">' + PAY_ICONS[code] + '<span>' + PAY_LABELS[code] + '</span>' + (code === "crypto_manual" ? "<small>BTC &middot; LTC</small>" : "") + '</div>';
    }
    html += '</div><div id="payDetail">' + detail + '</div>';
    html += '<div class="mt-2"><div class="coupon-row"><input id="couponInput" placeholder="Discount code" value="' + escapeHtml(state.coupon_code) + '"><button class="btn btn-ghost" id="applyCoupon">Apply</button></div>';
    if (state.couponError) html += '<div class="alert alert-danger mt-1">' + state.couponError + '</div>';
    if (state.discount > 0) html += '<div class="alert alert-success mt-1">Discount applied: -' + ESH.formatPrice(state.discount) + '</div>';
    html += '</div><div class="flex justify-between mt-3"><button class="btn btn-ghost btn-sm" id="btnBack">&larr; Back</button><button class="btn btn-primary" id="confirmOrder" ' + (state.payment_method ? "" : "disabled") + '>Confirm & pay</button></div></div>';
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
      html += '<div class="summary-line-item"><span>' + items[i].qty + "&times; " + escapeHtml(items[i].title) + '</span><span>' + ESH.formatPrice(items[i].price * items[i].qty) + '</span></div>';
    }
    html += '</div><div class="summary-item"><span>Subtotal</span><span>' + ESH.formatPrice(subtotal) + '</span></div>';
    if (state.discount > 0) html += '<div class="summary-item"><span>Discount</span><span>-' + ESH.formatPrice(state.discount) + '</span></div>';
    html += '<div class="summary-item"><span>Shipping</span><span>' + (shippingCost ? ESH.formatPrice(shippingCost) : "Free") + '</span></div>';
    html += '<div class="summary-item"><span>VAT (22%)</span><span>' + ESH.formatPrice(tax) + '</span></div>';
    html += '<div class="summary-item total"><span>Total</span><span>' + ESH.formatPrice(total) + '</span></div>';
    html += '<div class="trust-row">Secure payment &mdash; Manual staff verification</div></div>';
    document.getElementById("summaryCard").innerHTML = html;
  }

  function bindEvents() {
    var qtyInputs = document.querySelectorAll("[data-qty]");
    for (var i = 0; i < qtyInputs.length; i++) {
      qtyInputs[i].onchange = function() {
        ESH.cart.updateQty(Number(this.dataset.qty), Number(this.value));
        state.needsShipping = ESH.cart.hasPhysical();
        render();
      };
    }

    var removeBtns = document.querySelectorAll("[data-remove]");
    for (var i = 0; i < removeBtns.length; i++) {
      removeBtns[i].onclick = function() {
        ESH.cart.remove(Number(this.dataset.remove));
        state.needsShipping = ESH.cart.hasPhysical();
        if (ESH.cart.count() === 0) return init();
        render();
      };
    }

    var btnNext = document.getElementById("btnNext");
    if (btnNext) {
      btnNext.onclick = function() {
        if (state.step === 1 && state.needsShipping) {
          state.step = 2;
        } else if (state.step === 2 && state.needsShipping) {
          // Validate shipping
          state.shipping = {
            label: "Home",
            line1: val("line1"), line2: val("line2"), city: val("city"),
            state: val("state"), postal_code: val("postal_code"), country: val("country")
          };
          var emailInput = document.getElementById("guestEmail");
          if (emailInput) state.guest_email = emailInput.value;
          if (!state.shipping.line1 || !state.shipping.city || !state.shipping.postal_code) {
            ESH.toast("Please fill in all required address fields.", "error");
            return;
          }
          state.step = totalSteps();
        } else if (state.step === 1 && !state.needsShipping) {
          state.step = totalSteps();
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

    var methodEls = document.querySelectorAll("[data-method]");
    for (var i = 0; i < methodEls.length; i++) {
      methodEls[i].onclick = function() {
        state.payment_method = this.dataset.method;
        state.wallet_id = null;
        render();
      };
    }

    var walletEls = document.querySelectorAll("[data-wallet]");
    for (var i = 0; i < walletEls.length; i++) {
      walletEls[i].onclick = function() {
        state.wallet_id = Number(this.dataset.wallet);
        render();
      };
    }

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
    if (confirmBtn) {
      confirmBtn.onclick = submitOrder;
    }
  }

  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }

  async function submitOrder() {
    if (state.payment_method === "crypto_manual" && !state.wallet_id) {
      return ESH.toast("Please select a cryptocurrency (BTC or LTC).", "error");
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
    var order = data.order;
    var pi = data.payment_instructions;
    var block = "";

    if (pi.type === "paypal") {
      block = '<div class="glass" style="padding:1.5rem; text-align:left; margin-top:1.5rem;"><strong style="font-size:1.1rem;">PayPal</strong><div style="background:var(--panel); border-radius:10px; padding:1rem; margin-top:0.8rem;"><div>Send <strong>' + ESH.formatPrice(pi.amount) + '</strong> to:</div><code style="color:var(--blue-2); word-break:break-all;">' + escapeHtml(pi.email) + '</code><div style="margin-top:0.6rem; font-size:0.85rem; color:var(--muted);">Reference: <strong>' + escapeHtml(pi.order_number) + '</strong></div></div><p style="margin-top:0.8rem; font-size:0.8rem; color:var(--muted-2);">' + escapeHtml(pi.note) + '</p></div>';
    } else if (pi.type === "revolut") {
      block = '<div class="glass" style="padding:1.5rem; text-align:left; margin-top:1.5rem;"><strong style="font-size:1.1rem;">Revolut</strong><div style="background:var(--panel); border-radius:10px; padding:1rem; margin-top:0.8rem;"><div>Pay <strong>' + ESH.formatPrice(pi.amount) + '</strong> via:</div><a href="' + escapeHtml(pi.link) + '" target="_blank" rel="noopener" style="display:inline-block; margin:0.5rem 0; padding:0.6rem 1.2rem; background:var(--blue); color:#fff; border-radius:8px; font-weight:600;">Open Revolut</a><div style="margin-top:0.6rem; font-size:0.85rem; color:var(--muted);">Description: <strong>' + escapeHtml(pi.order_number) + '</strong></div></div><p style="margin-top:0.8rem; font-size:0.8rem; color:var(--muted-2);">' + escapeHtml(pi.note) + '</p></div>';
    } else if (pi.type === "crypto") {
      block = '<div class="glass" style="padding:1.5rem; text-align:left; margin-top:1.5rem;"><strong style="font-size:1.1rem;">' + escapeHtml(pi.network) + '</strong><div style="background:#0a0c10; border:1px solid var(--border); border-radius:10px; padding:1rem; margin-top:0.8rem;"><div style="font-size:0.85rem; color:var(--muted);">Send <strong>' + ESH.formatPrice(pi.amount_eur) + '</strong> to:</div><code style="display:block; padding:0.7rem; background:rgba(0,0,0,0.3); border-radius:8px; color:var(--blue-2); word-break:break-all; font-size:0.8rem; margin-top:0.5rem;">' + escapeHtml(pi.address) + '</code><div style="margin-top:0.6rem; font-size:0.85rem; color:var(--muted);">Order: <strong>' + escapeHtml(pi.order_number) + '</strong></div></div><p style="margin-top:0.8rem; font-size:0.8rem; color:var(--muted-2);">' + escapeHtml(pi.note) + '</p></div>';
    } else {
      block = '<div class="glass" style="padding:1.5rem; margin-top:1.5rem; text-align:center; color:var(--muted);">' + escapeHtml(pi.note || "") + '</div>';
    }

    document.querySelector(".checkout-steps-wrap").innerHTML = "";
    document.getElementById("stepContent").innerHTML = '<div class="glass checkout-panel success-screen"><div class="success-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M5 13l4 4L19 7"/></svg></div><h2>Order received</h2><p style="color:var(--muted); margin-top:0.3rem;">Order number: <strong>' + escapeHtml(order.order_number) + '</strong></p><span class="badge badge-warning" style="margin-top:0.5rem;">Awaiting payment verification</span>' + block + '<div style="margin-top:1.5rem; display:flex; gap:0.8rem; justify-content:center; flex-wrap:wrap;"><a href="/dashboard.html" class="btn btn-primary">My orders</a><a href="/products.html" class="btn btn-ghost">Continue shopping</a></div></div>';
    document.getElementById("summaryCard").innerHTML = "";
  }

  function escapeHtml(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  window.addEventListener("DOMContentLoaded", init);
})();
