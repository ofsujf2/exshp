// public/js/admin.js — ExecutiveShop Admin Panel
(function () {
  let CATEGORIES = [];

  async function guard() {
    const r = await ESH.api('/api/auth/me');
    if (!r.ok || !r.data.user || r.data.user.role !== 'admin') { location.href = '/login.html'; return; }
    bindNav();
    loadSection('dashboard');
  }

  function bindNav() {
    document.querySelectorAll('[data-section]').forEach(a => {
      a.addEventListener('click', () => {
        document.querySelectorAll('[data-section]').forEach(x => x.classList.remove('active'));
        a.classList.add('active');
        loadSection(a.dataset.section);
      });
    });
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await ESH.api('/api/auth/logout', { method: 'POST' }); location.href = '/';
    });
  }

  function main() { return document.getElementById('adminMain'); }

  async function loadSection(name) {
    main().innerHTML = '<div class="skeleton" style="height:320px;"></div>';
    const fns = {
      dashboard: renderDashboard, products: renderProducts, orders: renderOrders,
      coupons: renderCoupons, wallets: renderWallets, gateways: renderGateways,
      apiproviders: renderApiProviders, reviews: renderReviews, tickets: renderTickets, settings: renderSettings
    };
    (fns[name] || renderDashboard)();
  }

  // ========== DASHBOARD ==========
  async function renderDashboard() {
    const r = await ESH.api('/api/admin/stats');
    if (!r.ok) { main().innerHTML = '<div class="glass" style="padding:2rem;">Error loading stats.</div>'; return; }
    const s = r.data;
    const maxDay = Math.max(1, ...s.sales_by_day.map(d => d.total || 0));
    main().innerHTML = `
    <h1 class="mb-3">Dashboard</h1>
    <div class="grid grid-4 mb-3">
      <div class="glass stat-card"><span class="text-muted">Revenue</span><b>${ESH.formatPrice(s.revenue)}</b></div>
      <div class="glass stat-card"><span class="text-muted">Orders</span><b>${s.orders_count}</b></div>
      <div class="glass stat-card"><span class="text-muted">Customers</span><b>${s.customers}</b></div>
      <div class="glass stat-card"><span class="text-muted">Pending</span><b>${s.pending_orders}</b></div>
    </div>
    <div class="hero-grid" style="align-items:flex-start;">
      <div class="glass" style="padding:1.8rem;">
        <h3 class="mb-2">Sales (14 days)</h3>
        <div class="flex items-end gap-1" style="height:160px;">
          ${s.sales_by_day.map(d => `<div style="flex:1; background:linear-gradient(180deg, var(--blue-2), var(--blue)); border-radius:4px 4px 0 0; height:${Math.max(4, (d.total || 0) / maxDay * 100)}%;" title="${d.day}: ${ESH.formatPrice(d.total || 0)}"></div>`).join('') || '<p class="text-muted">No data.</p>'}
        </div>
      </div>
      <div class="glass" style="padding:1.8rem;">
        <h3 class="mb-2">Top products</h3>
        ${s.top_products.map(p => `<div class="flex justify-between" style="padding:0.5rem 0; border-bottom:1px solid var(--border-soft);"><span>${p.title}</span><span class="text-muted">${p.sold} sold</span></div>`).join('') || '<p class="text-muted">No sales.</p>'}
      </div>
    </div>`;
  }

  // ========== PRODUCTS ==========
  async function renderProducts() {
    const [prodRes, catRes] = await Promise.all([ESH.api('/api/admin/products'), ESH.api('/api/categories')]);
    CATEGORIES = catRes.ok ? catRes.data.categories : [];
    const products = prodRes.ok ? prodRes.data.products : [];

    main().innerHTML = `
    <div class="section-head"><h1>Products</h1><button class="btn btn-primary" id="newProductBtn">+ New Product</button></div>
    <div class="glass" style="padding:0.4rem 1.2rem;">
      <table><thead><tr><th>Image</th><th>Title</th><th>Type</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
      <tbody>${products.map(p => `
        <tr>
          <td>${p.thumbnail ? `<img src="${p.thumbnail}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;" onerror="this.style.display='none'">` : '<div style="width:40px;height:40px;border-radius:8px;background:var(--panel);"></div>'}</td>
          <td><strong>${p.title}</strong></td>
          <td><span class="badge ${p.type === 'digital' ? 'badge-blue' : 'badge-muted'}">${p.type}</span></td>
          <td>${ESH.formatPrice(p.discount_price ?? p.price)}</td>
          <td>${p.unlimited_stock ? 'Unlimited' : p.stock}</td>
          <td><span class="badge badge-muted">${p.status}</span></td>
          <td class="flex gap-1">
            <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Edit</button>
            <button class="btn btn-ghost btn-sm" data-dup="${p.id}">Duplicate</button>
            <button class="btn btn-danger btn-sm" data-del="${p.id}">Delete</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="7" class="text-muted">No products.</td></tr>'}
      </tbody></table>
    </div>`;

    document.getElementById('newProductBtn').addEventListener('click', () => openProductModal(null));
    products.forEach(p => {
      document.querySelector(`[data-edit="${p.id}"]`).addEventListener('click', () => openProductModal(p));
    });
    document.querySelectorAll('[data-dup]').forEach(b => b.addEventListener('click', async () => {
      await ESH.api(`/api/admin/products/${b.dataset.dup}/duplicate`, { method: 'POST' }); renderProducts();
    }));
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this product?')) return;
      await ESH.api(`/api/admin/products/${b.dataset.del}`, { method: 'DELETE' }); renderProducts();
    }));
  }

  function openProductModal(p) {
    const isEdit = !!p;
    const modal = createModal(isEdit ? 'Edit Product' : 'New Product', `
      <div class="form-row">
        <div class="field"><label>Title *</label><input id="mTitle" value="${p ? esc(p.title) : ''}"></div>
        <div class="field"><label>SKU</label><input id="mSku" value="${p ? esc(p.sku || '') : ''}"></div>
      </div>
      <div class="field"><label>Description</label><textarea id="mDesc" rows="3">${p ? esc(p.description || '') : ''}</textarea></div>
      <div class="form-row">
        <div class="field"><label>Category</label><select id="mCategory"><option value="">—</option>${CATEGORIES.map(c => `<option value="${c.id}" ${p && p.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
        <div class="field"><label>Type</label><select id="mType"><option value="physical" ${p && p.type === 'physical' ? 'selected' : ''}>Physical</option><option value="digital" ${p && p.type === 'digital' ? 'selected' : ''}>Digital</option></select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Price (EUR) *</label><input type="number" step="0.01" id="mPrice" value="${p ? p.price : ''}"></div>
        <div class="field"><label>Discount Price</label><input type="number" step="0.01" id="mDiscount" value="${p && p.discount_price ? p.discount_price : ''}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Stock</label><input type="number" id="mStock" value="${p ? p.stock : 0}"></div>
        <div class="field"><label class="checkbox-row" style="margin-top:1.6rem;"><input type="checkbox" id="mUnlimited" ${p && p.unlimited_stock ? 'checked' : ''}> Unlimited (digital)</label></div>
      </div>
      <div class="field">
        <label>Product Image</label>
        <input type="file" id="mImageFile" accept="image/*">
        <div id="mImagePreview" class="mt-1">${p && p.thumbnail ? `<img src="${p.thumbnail}" style="width:100px;height:100px;border-radius:10px;object-fit:cover;">` : ''}</div>
        <input type="hidden" id="mThumbnail" value="${p ? esc(p.thumbnail || '') : ''}">
      </div>
      <div class="form-row">
        <div class="field"><label>Delivery (digital)</label><select id="mDelivery">
          <option value="none" ${p && p.delivery_type === 'none' ? 'selected' : ''}>None (physical)</option>
          <option value="license_key" ${p && p.delivery_type === 'license_key' ? 'selected' : ''}>License Key</option>
          <option value="file" ${p && p.delivery_type === 'file' ? 'selected' : ''}>Downloadable File</option>
          <option value="api" ${p && p.delivery_type === 'api' ? 'selected' : ''}>External API</option>
        </select></div>
        <div class="field"><label>Status</label><select id="mStatus">
          <option value="draft" ${p && p.status === 'draft' ? 'selected' : ''}>Draft</option>
          <option value="published" ${p && p.status === 'published' ? 'selected' : ''}>Published</option>
          <option value="archived" ${p && p.status === 'archived' ? 'selected' : ''}>Archived</option>
          <option value="hidden" ${p && p.status === 'hidden' ? 'selected' : ''}>Hidden</option>
        </select></div>
      </div>
      <div class="flex gap-2 mt-1">
        <label class="checkbox-row"><input type="checkbox" id="mFeatured" ${p && p.featured ? 'checked' : ''}> Featured</label>
        <label class="checkbox-row"><input type="checkbox" id="mTrending" ${p && p.trending ? 'checked' : ''}> Trending</label>
        <label class="checkbox-row"><input type="checkbox" id="mNew" ${p && p.new_arrival ? 'checked' : ''}> New Arrival</label>
      </div>
    `, isEdit ? 'Save' : 'Create');

    // IMAGE UPLOAD - Convert to base64 and save directly
    document.getElementById('mImageFile').addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        var base64 = ev.target.result;
        document.getElementById('mThumbnail').value = base64;
        document.getElementById('mImagePreview').innerHTML = '<img src="' + base64 + '" style="width:100px;height:100px;border-radius:10px;object-fit:cover;">';
      };
      reader.readAsDataURL(file);
    });

    modal.confirmBtn.addEventListener('click', async () => {
      const body = {
        title: val('mTitle'), sku: val('mSku') || null, description: val('mDesc'),
        category_id: val('mCategory') ? Number(val('mCategory')) : null,
        type: val('mType'), price: Number(val('mPrice')) || 0,
        discount_price: val('mDiscount') ? Number(val('mDiscount')) : null,
        stock: Number(val('mStock')) || 0, unlimited_stock: document.getElementById('mUnlimited').checked,
        thumbnail: val('mThumbnail') || '', delivery_type: val('mDelivery'), status: val('mStatus'),
        featured: document.getElementById('mFeatured').checked,
        trending: document.getElementById('mTrending').checked,
        new_arrival: document.getElementById('mNew').checked
      };
      if (!body.title || !body.price) return ESH.toast('Title and price are required.', 'error');
      const res = isEdit
        ? await ESH.api('/api/admin/products/' + p.id, { method: 'PUT', body })
        : await ESH.api('/api/admin/products', { method: 'POST', body });
      if (!res.ok) return ESH.toast(res.error, 'error');
      ESH.toast('Product saved.', 'success');
      closeModal();
      renderProducts();
    });
  }

  // ========== ORDERS ==========
  async function renderOrders() {
    const r = await ESH.api('/api/admin/orders');
    const orders = r.ok ? r.data.orders : [];
    main().innerHTML = `
    <h1 class="mb-3">Orders</h1>
    <div class="glass" style="padding:0.4rem 1.2rem;">
      <table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Method</th><th>Status</th><th>Payment</th><th></th></tr></thead>
      <tbody>${orders.map(o => `
        <tr><td>${o.order_number}</td><td>${o.customer_name || o.customer_email || 'Guest'}</td>
        <td>${ESH.formatPrice(o.total, o.currency)}</td><td>${o.payment_method}</td>
        <td><span class="badge badge-muted">${o.status}</span></td>
        <td><span class="badge ${o.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}">${o.payment_status}</span></td>
        <td><button class="btn btn-ghost btn-sm" data-order="${o.id}">Manage</button></td></tr>`).join('') || '<tr><td colspan="7" class="text-muted">No orders.</td></tr>'}
      </tbody></table>
    </div>`;
    orders.forEach(o => document.querySelector(`[data-order="${o.id}"]`).addEventListener('click', () => openOrderModal(o.id)));
  }

  async function openOrderModal(id) {
    const r = await ESH.api('/api/admin/orders/' + id);
    if (!r.ok) return ESH.toast(r.error, 'error');
    const { order, items } = r.data;
    const modal = createModal('Order ' + order.order_number, `
      <div class="mb-2">${items.map(i => `<div class="flex justify-between" style="padding:0.4rem 0;"><span>${i.quantity}&times; ${i.title}</span><span>${ESH.formatPrice(i.price * i.quantity)}</span></div>`).join('')}</div>
      <div class="form-row">
        <div class="field"><label>Order Status</label><select id="oStatus">
          ${['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'].map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select></div>
        <div class="field"><label>Payment Status</label><select id="oPayment">
          ${['unpaid', 'pending_verification', 'paid', 'refunded', 'failed'].map(s => `<option value="${s}" ${order.payment_status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Tracking</label><input id="oTracking" value="${order.tracking_number || ''}"></div>
        <div class="field"><label>Carrier</label><input id="oCarrier" value="${order.carrier || ''}"></div>
      </div>
      <div class="field"><label>Notes</label><textarea id="oNotes" rows="2">${order.notes || ''}</textarea></div>
    `, 'Save');

    modal.confirmBtn.addEventListener('click', async () => {
      const body = { status: val('oStatus'), payment_status: val('oPayment'), tracking_number: val('oTracking'), carrier: val('oCarrier'), notes: val('oNotes') };
      const res = await ESH.api('/api/admin/orders/' + id, { method: 'PUT', body });
      if (!res.ok) return ESH.toast(res.error, 'error');
      ESH.toast('Order updated.', 'success'); closeModal(); renderOrders();
    });
  }

  // ========== COUPONS ==========
  async function renderCoupons() {
    const r = await ESH.api('/api/admin/coupons');
    const coupons = r.ok ? r.data.coupons : [];
    main().innerHTML = `
    <div class="section-head"><h1>Coupons</h1><button class="btn btn-primary" id="newCouponBtn">+ New Coupon</button></div>
    <div class="glass" style="padding:0.4rem 1.2rem;">
      <table><thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Uses</th><th>Status</th><th></th></tr></thead>
      <tbody>${coupons.map(c => `<tr><td>${c.code}</td><td>${c.type}</td><td>${c.type === 'percentage' ? c.value + '%' : ESH.formatPrice(c.value)}</td>
        <td>${c.used_count}${c.usage_limit ? '/' + c.usage_limit : ''}</td>
        <td><span class="badge ${c.status === 'active' ? 'badge-success' : 'badge-muted'}">${c.status}</span></td>
        <td class="flex gap-1"><button class="btn btn-ghost btn-sm" data-toggle="${c.id}" data-status="${c.status}">${c.status === 'active' ? 'Disable' : 'Enable'}</button><button class="btn btn-danger btn-sm" data-del="${c.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="6" class="text-muted">No coupons.</td></tr>'}
      </tbody></table>
    </div>`;
    document.getElementById('newCouponBtn').addEventListener('click', () => openCouponModal());
    document.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
      await ESH.api('/api/admin/coupons/' + b.dataset.toggle, { method: 'PUT', body: { status: b.dataset.status === 'active' ? 'disabled' : 'active' } });
      renderCoupons();
    }));
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await ESH.api('/api/admin/coupons/' + b.dataset.del, { method: 'DELETE' }); renderCoupons();
    }));
  }

  function openCouponModal() {
    const modal = createModal('New Coupon', `
      <div class="form-row">
        <div class="field"><label>Code</label><input id="cCode" style="text-transform:uppercase;"></div>
        <div class="field"><label>Type</label><select id="cType"><option value="percentage">Percentage</option><option value="fixed">Fixed</option><option value="free_shipping">Free Shipping</option></select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Value</label><input type="number" id="cValue" value="10"></div>
        <div class="field"><label>Usage Limit</label><input type="number" id="cLimit"></div>
      </div>
      <div class="field"><label>Min Order (EUR)</label><input type="number" id="cMin"></div>
    `, 'Create');
    modal.confirmBtn.addEventListener('click', async () => {
      const body = { code: val('cCode'), type: val('cType'), value: Number(val('cValue')) || 0, usage_limit: val('cLimit') ? Number(val('cLimit')) : null, min_order: val('cMin') ? Number(val('cMin')) : null };
      if (!body.code) return ESH.toast('Code required.', 'error');
      const res = await ESH.api('/api/admin/coupons', { method: 'POST', body });
      if (!res.ok) return ESH.toast(res.error, 'error');
      ESH.toast('Coupon created.', 'success'); closeModal(); renderCoupons();
    });
  }

  // ========== WALLETS ==========
  async function renderWallets() {
    const r = await ESH.api('/api/admin/wallets');
    const wallets = r.ok ? r.data.wallets : [];
    main().innerHTML = `
    <div class="section-head"><h1>Crypto Wallets</h1><button class="btn btn-primary" id="newWalletBtn">+ New Wallet</button></div>
    <div class="glass" style="padding:0.4rem 1.2rem;">
      <table><thead><tr><th>Name</th><th>Network</th><th>Address</th><th>Min</th><th>Status</th><th></th></tr></thead>
      <tbody>${wallets.map(w => `<tr><td>${w.name}</td><td><span class="badge badge-blue">${w.network}</span></td><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;"><code>${w.address}</code></td><td>${ESH.formatPrice(w.min_amount)}</td>
        <td><span class="badge ${w.status === 'active' ? 'badge-success' : 'badge-muted'}">${w.status}</span></td>
        <td class="flex gap-1"><button class="btn btn-ghost btn-sm" data-toggle="${w.id}" data-status="${w.status}">${w.status === 'active' ? 'Disable' : 'Enable'}</button><button class="btn btn-danger btn-sm" data-del="${w.id}">Delete</button></td></tr>`).join('') || '<tr><td colspan="6" class="text-muted">No wallets.</td></tr>'}
      </tbody></table>
    </div>`;
    document.getElementById('newWalletBtn').addEventListener('click', () => openWalletModal());
    document.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
      await ESH.api('/api/admin/wallets/' + b.dataset.toggle, { method: 'PUT', body: { status: b.dataset.status === 'active' ? 'disabled' : 'active' } });
      renderWallets();
    }));
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await ESH.api('/api/admin/wallets/' + b.dataset.del, { method: 'DELETE' }); renderWallets();
    }));
  }

  function openWalletModal() {
    const modal = createModal('New Wallet', `
      <div class="form-row">
        <div class="field"><label>Name</label><input id="wName" placeholder="e.g. Bitcoin"></div>
        <div class="field"><label>Network</label><select id="wNetwork"><option value="BTC">BTC</option><option value="LTC">LTC</option><option value="ETH">ETH</option><option value="TRC20">USDT (TRC20)</option></select></div>
      </div>
      <div class="field"><label>Address</label><input id="wAddress" placeholder="Wallet address"></div>
      <div class="field"><label>Min Amount (EUR)</label><input type="number" id="wMin" value="5"></div>
    `, 'Create');
    modal.confirmBtn.addEventListener('click', async () => {
      const body = { name: val('wName'), network: val('wNetwork'), address: val('wAddress'), min_amount: Number(val('wMin')) || 0 };
      if (!body.name || !body.address) return ESH.toast('Name and address required.', 'error');
      const res = await ESH.api('/api/admin/wallets', { method: 'POST', body });
      if (!res.ok) return ESH.toast(res.error, 'error');
      ESH.toast('Wallet created.', 'success'); closeModal(); renderWallets();
    });
  }

  // ========== GATEWAYS ==========
  async function renderGateways() {
    const r = await ESH.api('/api/admin/gateways');
    const gws = r.ok ? r.data.gateways : [];
    main().innerHTML = `
    <h1 class="mb-3">Payment Methods</h1>
    <div class="grid grid-3">
      ${gws.map(g => `
        <div class="glass" style="padding:1.4rem;">
          <h4>${g.name}</h4>
          <span class="badge ${g.status === 'enabled' ? 'badge-success' : 'badge-muted'}">${g.status}</span>
          <button class="btn ${g.status === 'enabled' ? 'btn-danger' : 'btn-primary'} btn-sm mt-2" data-toggle="${g.id}" data-status="${g.status}">${g.status === 'enabled' ? 'Disable' : 'Enable'}</button>
        </div>`).join('')}
    </div>`;
    document.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
      await ESH.api('/api/admin/gateways/' + b.dataset.toggle, { method: 'PUT', body: { status: b.dataset.status === 'enabled' ? 'disabled' : 'enabled' } });
      renderGateways();
    }));
  }

  // ========== SETTINGS ==========
  async function renderSettings() {
    const r = await ESH.api('/api/admin/settings');
    const s = r.ok ? r.data.settings : {};
    main().innerHTML = `
    <h1 class="mb-3">Settings</h1>
    <div class="glass" style="padding:1.6rem; max-width:520px;">
      <div class="field"><label>Store Name</label><input id="sName" value="${s.store_name || ''}"></div>
      <div class="field"><label>Currency</label><input id="sCurrency" value="${s.currency || 'EUR'}"></div>
      <button class="btn btn-primary" id="sSave">Save</button>
    </div>`;
    document.getElementById('sSave').addEventListener('click', async () => {
      await ESH.api('/api/admin/settings', { method: 'PUT', body: { store_name: val('sName'), currency: val('sCurrency') } });
      ESH.toast('Saved.', 'success');
    });
  }

  // ========== STUBS ==========
  async function renderApiProviders() { main().innerHTML = '<h1>API Providers</h1><p class="text-muted">Coming soon.</p>'; }
  async function renderReviews() { main().innerHTML = '<h1>Reviews</h1><p class="text-muted">Coming soon.</p>'; }
  async function renderTickets() { main().innerHTML = '<h1>Tickets</h1><p class="text-muted">Coming soon.</p>'; }

  // ========== MODAL ==========
  function createModal(title, bodyHtml, confirmLabel) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1.5rem;';
    overlay.innerHTML = `
      <div class="glass-strong" style="max-width:560px;width:100%;max-height:88vh;overflow-y:auto;padding:1.8rem;">
        <div class="flex justify-between items-center mb-2"><h3>${title}</h3><button class="icon-btn" id="modalClose">&times;</button></div>
        <div id="modalBody">${bodyHtml}</div>
        <div class="flex justify-between mt-2"><button class="btn btn-ghost" id="modalCancel">Cancel</button><button class="btn btn-primary" id="modalConfirm">${confirmLabel}</button></div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalCancel').addEventListener('click', closeModal);
    return { confirmBtn: document.getElementById('modalConfirm') };
  }
  function closeModal() { const m = document.querySelector('[style*="position:fixed"]'); if (m) m.remove(); }

  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function esc(s) { return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  guard();
})();
