// public/js/admin.js
(function () {
  let CATEGORIES = [];
  let APIPROVIDERS = [];

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

  // ---------------- DASHBOARD ----------------
  async function renderDashboard() {
    const r = await ESH.api('/api/admin/stats');
    if (!r.ok) { main().innerHTML = '<div class="glass" style="padding:2rem;">Errore caricamento statistiche.</div>'; return; }
    const s = r.data;
    const maxDay = Math.max(1, ...s.sales_by_day.map(d => d.total || 0));
    main().innerHTML = `
    <h1 class="mb-3">Dashboard</h1>
    <div class="grid grid-4 mb-3">
      <div class="glass stat-card"><span class="text-muted">Fatturato totale</span><b>${ESH.formatPrice(s.revenue)}</b></div>
      <div class="glass stat-card"><span class="text-muted">Ordini totali</span><b>${s.orders_count}</b></div>
      <div class="glass stat-card"><span class="text-muted">Clienti</span><b>${s.customers}</b></div>
      <div class="glass stat-card"><span class="text-muted">In verifica</span><b>${s.pending_orders}</b></div>
    </div>
    <div class="hero-grid" style="align-items:flex-start;">
      <div class="glass" style="padding:1.8rem;">
        <h3 class="mb-2">Vendite ultimi 14 giorni</h3>
        <div class="flex items-end gap-1" style="height:160px;">
          ${s.sales_by_day.map(d => `<div style="flex:1; background:linear-gradient(180deg, var(--blue-2), var(--blue)); border-radius:4px 4px 0 0; height:${Math.max(4, (d.total || 0) / maxDay * 100)}%;" title="${d.day}: ${ESH.formatPrice(d.total || 0)}"></div>`).join('') || '<p class="text-muted">Nessun dato ancora.</p>'}
        </div>
      </div>
      <div class="glass" style="padding:1.8rem;">
        <h3 class="mb-2">Prodotti piu venduti</h3>
        ${s.top_products.map(p => `<div class="flex justify-between" style="padding:0.5rem 0; border-bottom:1px solid var(--border-soft);"><span>${p.title}</span><span class="text-muted">${p.sold} vendute</span></div>`).join('') || '<p class="text-muted">Nessuna vendita ancora.</p>'}
      </div>
    </div>
    <div class="hero-grid mt-3" style="align-items:flex-start;">
      <div class="glass" style="padding:1.8rem;">
        <h3 class="mb-2">Ultimi ordini</h3>
        <table><thead><tr><th>Ordine</th><th>Cliente</th><th>Totale</th><th>Stato</th></tr></thead>
        <tbody>${s.latest_orders.map(o => `<tr><td>${o.order_number}</td><td>${o.customer_name || 'Ospite'}</td><td>${ESH.formatPrice(o.total)}</td><td><span class="badge ${o.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}">${o.payment_status}</span></td></tr>`).join('') || '<tr><td colspan="4" class="text-muted">Nessun ordine.</td></tr>'}</tbody></table>
      </div>
      <div class="glass" style="padding:1.8rem;">
        <h3 class="mb-2">Scorte basse</h3>
        ${s.low_stock.length ? s.low_stock.map(p => `<div class="flex justify-between" style="padding:0.5rem 0;"><span>${p.title}</span><span class="badge badge-danger">${p.stock} rimasti</span></div>`).join('') : '<p class="text-muted">Tutto sotto controllo.</p>'}
      </div>
    </div>`;
  }

  // ---------------- PRODOTTI ----------------
  async function renderProducts() {
    const [prodRes, catRes] = await Promise.all([ESH.api('/api/admin/products'), ESH.api('/api/categories')]);
    CATEGORIES = catRes.ok ? catRes.data.categories : [];
    const products = prodRes.ok ? prodRes.data.products : [];

    main().innerHTML = `
    <div class="section-head"><h1>Prodotti</h1><button class="btn btn-primary" id="newProductBtn">+ Nuovo prodotto</button></div>
    <div class="glass" style="padding:0.4rem 1.2rem;">
      <table><thead><tr><th>Titolo</th><th>Tipo</th><th>Prezzo</th><th>Stock</th><th>Stato</th><th></th></tr></thead>
      <tbody>${products.map(p => `
        <tr>
          <td class="flex items-center gap-1">${p.thumbnail ? `<img src="${p.thumbnail}" style="width:34px;height:34px;border-radius:8px;object-fit:cover;">` : ''}${p.title}</td>
          <td><span class="badge ${p.type === 'digital' ? 'badge-blue' : 'badge-muted'}">${p.type}</span></td>
          <td>${ESH.formatPrice(p.discount_price ?? p.price)}</td>
          <td>${p.unlimited_stock ? 'Illimitato' : p.stock}</td>
          <td><span class="badge badge-muted">${p.status}</span></td>
          <td class="flex gap-1">
            <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Modifica</button>
            <button class="btn btn-ghost btn-sm" data-dup="${p.id}">Duplica</button>
            <button class="btn btn-danger btn-sm" data-del="${p.id}">Elimina</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="6" class="text-muted">Nessun prodotto.</td></tr>'}
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
      if (!confirm('Eliminare questo prodotto?')) return;
      await ESH.api(`/api/admin/products/${b.dataset.del}`, { method: 'DELETE' }); renderProducts();
    }));
  }

  function openProductModal(p) {
    const isEdit = !!p;
    const modal = createModal(isEdit ? 'Modifica prodotto' : 'Nuovo prodotto', `
      <div class="form-row">
        <div class="field"><label>Titolo</label><input id="mTitle" value="${p ? escapeAttr(p.title) : ''}"></div>
        <div class="field"><label>SKU</label><input id="mSku" value="${p ? escapeAttr(p.sku || '') : ''}"></div>
      </div>
      <div class="field"><label>Descrizione</label><textarea id="mDesc" rows="3">${p ? escapeAttr(p.description || '') : ''}</textarea></div>
      <div class="form-row">
        <div class="field"><label>Categoria</label><select id="mCategory"><option value="">—</option>${CATEGORIES.map(c => `<option value="${c.id}" ${p && p.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
        <div class="field"><label>Tipo</label><select id="mType"><option value="physical" ${p && p.type === 'physical' ? 'selected' : ''}>Fisico</option><option value="digital" ${p && p.type === 'digital' ? 'selected' : ''}>Digitale</option></select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Prezzo (EUR)</label><input type="number" step="0.01" id="mPrice" value="${p ? p.price : ''}"></div>
        <div class="field"><label>Prezzo scontato</label><input type="number" step="0.01" id="mDiscount" value="${p && p.discount_price ? p.discount_price : ''}"></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Stock</label><input type="number" id="mStock" value="${p ? p.stock : 0}"></div>
        <div class="field"><label class="checkbox-row" style="margin-top:1.6rem;"><input type="checkbox" id="mUnlimited" ${p && p.unlimited_stock ? 'checked' : ''}> Scorta illimitata (digitale)</label></div>
      </div>
      <div class="field">
        <label>Immagine prodotto</label>
        <input type="file" id="mImageFile" accept="image/png,image/jpeg,image/webp,image/gif">
        <div id="mImagePreview" class="mt-1">${p && p.thumbnail ? `<img src="${p.thumbnail}" style="width:90px;height:90px;border-radius:10px;object-fit:cover;">` : ''}</div>
        <input type="hidden" id="mThumbnail" value="${p ? escapeAttr(p.thumbnail || '') : ''}">
      </div>
      <div class="form-row">
        <div class="field"><label>Modalita consegna (digitale)</label><select id="mDelivery">
          <option value="none" ${p && p.delivery_type === 'none' ? 'selected' : ''}>Nessuna (fisico)</option>
          <option value="license_key" ${p && p.delivery_type === 'license_key' ? 'selected' : ''}>Chiave di licenza</option>
          <option value="file" ${p && p.delivery_type === 'file' ? 'selected' : ''}>File scaricabile</option>
          <option value="api" ${p && p.delivery_type === 'api' ? 'selected' : ''}>API esterna</option>
        </select></div>
        <div class="field"><label>Stato</label><select id="mStatus">
          <option value="draft" ${p && p.status === 'draft' ? 'selected' : ''}>Bozza</option>
          <option value="published" ${p && p.status === 'published' ? 'selected' : ''}>Pubblicato</option>
          <option value="archived" ${p && p.status === 'archived' ? 'selected' : ''}>Archiviato</option>
          <option value="hidden" ${p && p.status === 'hidden' ? 'selected' : ''}>Nascosto</option>
        </select></div>
      </div>
      <div class="flex gap-2 mt-1">
        <label class="checkbox-row"><input type="checkbox" id="mFeatured" ${p && p.featured ? 'checked' : ''}> In evidenza</label>
        <label class="checkbox-row"><input type="checkbox" id="mTrending" ${p && p.trending ? 'checked' : ''}> Trending</label>
        <label class="checkbox-row"><input type="checkbox" id="mNew" ${p && p.new_arrival ? 'checked' : ''}> Novita</label>
      </div>
    `, isEdit ? 'Salva modifiche' : 'Crea prodotto');

    document.getElementById('mImageFile').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const dataUrl = await fileToDataUrl(file);
      const up = await ESH.api('/api/admin/upload', { method: 'POST', body: { data_url: dataUrl } });
      if (!up.ok) return ESH.toast(up.error, 'error');
      document.getElementById('mThumbnail').value = up.data.url;
      document.getElementById('mImagePreview').innerHTML = `<img src="${up.data.url}" style="width:90px;height:90px;border-radius:10px;object-fit:cover;">`;
      ESH.toast('Immagine caricata.', 'success');
    });

    modal.confirmBtn.addEventListener('click', async () => {
      const body = {
        title: val('mTitle'), sku: val('mSku') || null, description: val('mDesc'),
        category_id: val('mCategory') ? Number(val('mCategory')) : null,
        type: val('mType'), price: Number(val('mPrice')) || 0,
        discount_price: val('mDiscount') ? Number(val('mDiscount')) : null,
        stock: Number(val('mStock')) || 0, unlimited_stock: document.getElementById('mUnlimited').checked,
        thumbnail: val('mThumbnail'), delivery_type: val('mDelivery'), status: val('mStatus'),
        featured: document.getElementById('mFeatured').checked, trending: document.getElementById('mTrending').checked,
        new_arrival: document.getElementById('mNew').checked
      };
      if (!body.title || !body.price) return ESH.toast('Titolo e prezzo sono obbligatori.', 'error');
      const res = isEdit ? await ESH.api(`/api/admin/products/${p.id}`, { method: 'PUT', body }) : await ESH.api('/api/admin/products', { method: 'POST', body });
      if (!res.ok) return ESH.toast(res.error, 'error');
      ESH.toast('Prodotto salvato.', 'success'); closeModal(); renderProducts();
    });
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---------------- ORDINI ----------------
  async function renderOrders() {
    const r = await ESH.api('/api/admin/orders');
    const orders = r.ok ? r.data.orders : [];
    main().innerHTML = `
    <h1 class="mb-3">Ordini</h1>
    <div class="glass" style="padding:0.4rem 1.2rem;">
      <table><thead><tr><th>Ordine</th><th>Cliente</th><th>Totale</th><th>Metodo</th><th>Stato</th><th>Pagamento</th><th></th></tr></thead>
      <tbody>${orders.map(o => `
        <tr><td>${o.order_number}</td><td>${o.customer_name || o.customer_email || 'Ospite'}</td>
        <td>${ESH.formatPrice(o.total, o.currency)}</td><td>${o.payment_method}</td>
        <td><span class="badge badge-muted">${o.status}</span></td>
        <td><span class="badge ${o.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}">${o.payment_status}</span></td>
        <td><button class="btn btn-ghost btn-sm" data-order="${o.id}">Gestisci</button></td></tr>`).join('') || '<tr><td colspan="7" class="text-muted">Nessun ordine.</td></tr>'}
      </tbody></table>
    </div>`;
    orders.forEach(o => document.querySelector(`[data-order="${o.id}"]`).addEventListener('click', () => openOrderModal(o.id)));
  }

  async function openOrderModal(id) {
    const r = await ESH.api('/api/admin/orders/' + id);
    if (!r.ok) return ESH.toast(r.error, 'error');
    const { order, items } = r.data;
    const modal = createModal(`Ordine ${order.order_number}`, `
      <div class="mb-2">${items.map(i => `<div class="flex justify-between" style="padding:0.4rem 0;"><span>${i.quantity}&times; ${i.title}</span><span>${ESH.formatPrice(i.price * i.quantity)}</span></div>`).join('')}</div>
      <div class="form-row">
        <div class="field"><label>Stato ordine</label><select id="oStatus">
          ${['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'].map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select></div>
        <div class="field"><label>Stato pagamento</label><select id="oPayment">
          ${['unpaid', 'pending_verification', 'paid', 'refunded', 'failed'].map(s => `<option value="${s}" ${order.payment_status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Tracking</label><input id="oTracking" value="${order.tracking_number || ''}"></div>
        <div class="field"><label>Corriere</label><input id="oCarrier" value="${order.carrier || ''}"></div>
      </div>
      <div class="field"><label>Note</label><textarea id="oNotes" rows="2">${order.notes || ''}</textarea></div>
      <p class="text-muted" style="font-size:0.78rem;">Impostando "Pagamento: paid" per un ordine con beni digitali, la licenza/consegna viene assegnata automaticamente.</p>
    `, 'Salva ordine');

    modal.confirmBtn.addEventListener('click', async () => {
      const body = { status: val('oStatus'), payment_status: val('oPayment'), tracking_number: val('oTracking'), carrier: val('oCarrier'), notes: val('oNotes') };
      const res = await ESH.api('/api/admin/orders/' + id, { method: 'PUT', body });
      if (!res.ok) return ESH.toast(res.error, 'error');
      ESH.toast('Ordine aggiornato.', 'success'); closeModal(); renderOrders();
    });
  }

  // ---------------- COUPON ----------------
  async function renderCoupons() {
    const r = await ESH.api('/api/admin/coupons');
    const coupons = r.ok ? r.data.coupons : [];
    main().innerHTML = `
    <div class="section-head"><h1>Coupon</h1><button class="btn btn-primary" id="newCouponBtn">+ Nuovo coupon</button></div>
    <div class="glass" style="padding:0.4rem 1.2rem;">
      <table><thead><tr><th>Codice</th><th>Tipo</th><th>Valore</th><th>Usi</th><th>Stato</th><th></th></tr></thead>
      <tbody>${coupons.map(c => `<tr><td>${c.code}</td><td>${c.type}</td><td>${c.type === 'percentage' ? c.value + '%' : ESH.formatPrice(c.value)}</td>
        <td>${c.used_count}${c.usage_limit ? '/' + c.usage_limit : ''}</td>
        <td><span class="badge ${c.status === 'active' ? 'badge-success' : 'badge-muted'}">${c.status}</span></td>
        <td class="flex gap-1"><button class="btn btn-ghost btn-sm" data-toggle="${c.id}" data-status="${c.status}">${c.status === 'active' ? 'Disattiva' : 'Attiva'}</button><button class="btn btn-danger btn-sm" data-del="${c.id}">Elimina</button></td></tr>`).join('') || '<tr><td colspan="6" class="text-muted">Nessun coupon.</td></tr>'}
      </tbody></table>
    </div>`;
    document.getElementById('newCouponBtn').addEventListener('click', openCouponModal);
    document.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
      const newStatus = b.dataset.status === 'active' ? 'disabled' : 'active';
      await ESH.api('/api/admin/coupons/' + b.dataset.toggle, { method: 'PUT', body: { status: newStatus } }); renderCoupons();
    }));
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Eliminare il coupon?')) return;
      await ESH.api('/api/admin/coupons/' + b.dataset.del, { method: 'DELETE' }); renderCoupons();
    }));
  }

  function openCouponModal() {
    const modal = createModal('Nuovo coupon', `
      <div class="form-row">
        <div class="field"><label>Codice</label><input id="cCode" style="text-transform:uppercase;"></div>
        <div class="field"><label>Tipo</label><select id="cType"><option value="percentage">Percentuale</option><option value="fixed">Fisso</option><option value="free_shipping">Spedizione gratuita</option></select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Valore</label><input type="number" id="cValue" value="10"></div>
        <div class="field"><label>Limite utilizzi</label><input type="number" id="cLimit"></div>
      </div>
      <div class="field"><label>Ordine minimo (EUR)</label><input type="number" id="cMin"></div>
    `, 'Crea coupon');
    modal.confirmBtn.addEventListener('click', async () => {
      const body = { code: val('cCode'), type: val('cType'), value: Number(val('cValue')) || 0, usage_limit: val('cLimit') ? Number(val('cLimit')) : null, min_order: val('cMin') ? Number(val('cMin')) : null };
      if (!body.code) return ESH.toast('Codice richiesto.', 'error');
      const res = await ESH.api('/api/admin/coupons', { method: 'POST', body });
      if (!res.ok) return ESH.toast(res.error, 'error');
      ESH.toast('Coupon creato.', 'success'); closeModal(); renderCoupons();
    });
  }

  // ---------------- WALLET CRYPTO ----------------
  async function renderWallets() {
    const r = await ESH.api('/api/admin/wallets');
    const wallets = r.ok ? r.data.wallets : [];
    main().innerHTML = `
    <div class="section-head"><h1>Wallet Crypto</h1><button class="btn btn-primary" id="newWalletBtn">+ Nuovo wallet</button></div>
    <div class="glass" style="padding:0.4rem 1.2rem;">
      <table><thead><tr><th>Nome</th><th>Rete</th><th>Indirizzo</th><th>Min</th><th>Stato</th><th></th></tr></thead>
      <tbody>${wallets.map(w => `<tr><td>${w.name}</td><td><span class="badge badge-blue">${w.network}</span></td><td style="max-width:220px; overflow:hidden; text-overflow:ellipsis;"><code>${w.address}</code></td><td>${ESH.formatPrice(w.min_amount)}</td>
        <td><span class="badge ${w.status === 'active' ? 'badge-success' : 'badge-muted'}">${w.status}</span></td>
        <td class="flex gap-1"><button class="btn btn-ghost btn-sm" data-edit="${w.id}">Modifica</button><button class="btn btn-ghost btn-sm" data-toggle="${w.id}" data-status="${w.status}">${w.status === 'active' ? 'Disattiva' : 'Attiva'}</button><button class="btn btn-danger btn-sm" data-del="${w.id}">Elimina</button></td></tr>`).join('') || '<tr><td colspan="6" class="text-muted">Nessun wallet.</td></tr>'}
      </tbody></table>
    </div>`;
    document.getElementById('newWalletBtn').addEventListener('click', () => openWalletModal(null));
    wallets.forEach(w => document.querySelector(`[data-edit="${w.id}"]`).addEventListener('click', () => openWalletModal(w)));
    document.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
      const newStatus = b.dataset.status === 'active' ? 'disabled' : 'active';
      await ESH.api('/api/admin/wallets/' + b.dataset.toggle, { method: 'PUT', body: { status: newStatus } }); renderWallets();
    }));
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Eliminare il wallet?')) return;
      await ESH.api('/api/admin/wallets/' + b.dataset.del, { method: 'DELETE' }); renderWallets();
    }));
  }

  function openWalletModal() {
    const modal = createModal('Nuovo wallet crypto', `
      <div class="form-row">
        <div class="field"><label>Nome</label><input id="wName" placeholder="es. Bitcoin"></div>
        <div class="field"><label>Rete</label><select id="wNetwork">
          <option value="BTC">BTC — Bitcoin</option><option value="LTC">LTC — Litecoin</option>
          <option value="ETH">ETH — Ethereum</option><option value="TRC20">USDT (TRC20)</option>
        </select></div>
      </div>
      <div class="field"><label>Indirizzo wallet</label><input id="wAddress" placeholder="Indirizzo pubblico"></div>
      <div class="form-row">
        <div class="field"><label>Importo minimo (EUR)</label><input type="number" id="wMin" value="5"></div>
        <div class="field"><label class="checkbox-row" style="margin-top:1.6rem;"><input type="checkbox" id="wAuto"> Verifica automatica (richiede integrazione blockchain reale)</label></div>
      </div>
    `, 'Crea wallet');
    modal.confirmBtn.addEventListener('click', async () => {
      const body = { name: val('wName'), network: val('wNetwork'), address: val('wAddress'), min_amount: Number(val('wMin')) || 0, auto_verify: document.getElementById('wAuto').checked };
      if (!body.name || !body.address) return ESH.toast('Nome e indirizzo sono obbligatori.', 'error');
      const res = await ESH.api('/api/admin/wallets', { method: 'POST', body });
      if (!res.ok) return ESH.toast(res.error, 'error');
      ESH.toast('Wallet creato.', 'success'); closeModal(); renderWallets();
    });
  }

  // ---------------- GATEWAY PAGAMENTO ----------------
  async function renderGateways() {
    const r = await ESH.api('/api/admin/gateways');
    const gws = r.ok ? r.data.gateways : [];
    main().innerHTML = `
    <h1 class="mb-3">Metodi di pagamento</h1>
    <p class="text-muted mb-2" style="max-width:70ch;">Le chiavi API vivono nel file <code>.env</code> nella root del progetto (non nel database): modificale li, poi riavvia il server. Qui puoi solo attivare/disattivare il metodo nel checkout.</p>
    <div class="grid grid-3">
      ${gws.map(g => `
        <div class="glass" style="padding:1.4rem;">
          <div class="flex justify-between items-center mb-1"><h4>${g.name}</h4><span class="badge ${g.status === 'enabled' ? 'badge-success' : 'badge-muted'}">${g.status}</span></div>
          <div class="flex items-center gap-1 mb-2">
            <span class="badge ${g.configured ? 'badge-success' : 'badge-danger'}">${g.configured ? 'Chiavi configurate' : 'Chiavi mancanti in .env'}</span>
          </div>
          ${!g.configured && ['stripe', 'paypal', 'revolut'].includes(g.code) ? `<p class="text-muted" style="font-size:0.78rem;">Aggiungi le variabili ${g.code.toUpperCase()}_* nel file <code>.env</code> (vedi <code>.env.example</code>) e riavvia <code>node server.js</code>.</p>` : ''}
          ${g.code === 'bank_transfer' && !g.configured ? `<p class="text-muted" style="font-size:0.78rem;">Aggiungi BANK_IBAN e BANK_BENEFICIARY in <code>.env</code> per mostrare i tuoi dati reali.</p>` : ''}
          <button class="btn ${g.status === 'enabled' ? 'btn-danger' : 'btn-primary'} btn-sm mt-1" data-toggle="${g.id}" data-status="${g.status}">${g.status === 'enabled' ? 'Disattiva' : 'Attiva'}</button>
        </div>`).join('')}
    </div>`;
    document.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
      const newStatus = b.dataset.status === 'enabled' ? 'disabled' : 'enabled';
      await ESH.api('/api/admin/gateways/' + b.dataset.toggle, { method: 'PUT', body: { status: newStatus } }); renderGateways();
    }));
  }

  // ---------------- API PROVIDER ----------------
  async function renderApiProviders() {
    const r = await ESH.api('/api/admin/api-providers');
    APIPROVIDERS = r.ok ? r.data.providers : [];
    main().innerHTML = `
    <div class="section-head"><h1>API Provider</h1><button class="btn btn-primary" id="newProvBtn">+ Nuovo provider</button></div>
    <p class="text-muted mb-2" style="max-width:70ch;">Collega un provider esterno per la consegna automatica di beni digitali (es. chiavi generate da un servizio terzo). Il test di connessione richiede rete in uscita, non disponibile in questo ambiente sandbox.</p>
    <div class="glass" style="padding:0.4rem 1.2rem;">
      <table><thead><tr><th>Nome</th><th>Endpoint</th><th>Stato</th><th></th></tr></thead>
      <tbody>${APIPROVIDERS.map(p => `<tr><td>${p.name}</td><td style="max-width:260px; overflow:hidden; text-overflow:ellipsis;">${p.endpoint}</td>
        <td><span class="badge ${p.status === 'enabled' ? 'badge-success' : 'badge-muted'}">${p.status}</span></td>
        <td class="flex gap-1"><button class="btn btn-ghost btn-sm" data-test="${p.id}">Testa connessione</button><button class="btn btn-danger btn-sm" data-del="${p.id}">Elimina</button></td></tr>`).join('') || '<tr><td colspan="4" class="text-muted">Nessun provider.</td></tr>'}
      </tbody></table>
    </div>`;
    document.getElementById('newProvBtn').addEventListener('click', openProviderModal);
    document.querySelectorAll('[data-test]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = 'Test in corso...';
      const res = await ESH.api(`/api/admin/api-providers/${b.dataset.test}/test`, { method: 'POST' });
      ESH.toast(res.data ? res.data.message : res.error, (res.data && res.data.ok) ? 'success' : 'error');
      b.disabled = false; b.textContent = 'Testa connessione';
    }));
    document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Eliminare il provider?')) return;
      await ESH.api('/api/admin/api-providers/' + b.dataset.del, { method: 'DELETE' }); renderApiProviders();
    }));
  }

  function openProviderModal() {
    const modal = createModal('Nuovo API Provider', `
      <div class="field"><label>Nome</label><input id="pvName"></div>
      <div class="field"><label>Endpoint</label><input id="pvEndpoint" placeholder="https://api.provider.tld/deliver"></div>
      <div class="form-row">
        <div class="field"><label>API Key</label><input id="pvKey"></div>
        <div class="field"><label>API Secret</label><input id="pvSecret" type="password"></div>
      </div>
      <div class="field"><label class="checkbox-row"><input type="checkbox" id="pvEnabled"> Attiva subito</label></div>
    `, 'Crea provider');
    modal.confirmBtn.addEventListener('click', async () => {
      const body = { name: val('pvName'), endpoint: val('pvEndpoint'), api_key: val('pvKey'), api_secret: val('pvSecret'), status: document.getElementById('pvEnabled').checked ? 'enabled' : 'disabled' };
      if (!body.name || !body.endpoint) return ESH.toast('Nome ed endpoint richiesti.', 'error');
      const res = await ESH.api('/api/admin/api-providers', { method: 'POST', body });
      if (!res.ok) return ESH.toast(res.error, 'error');
      ESH.toast('Provider creato.', 'success'); closeModal(); renderApiProviders();
    });
  }

  // ---------------- RECENSIONI ----------------
  async function renderReviews() {
    const r = await ESH.api('/api/admin/reviews');
    const reviews = r.ok ? r.data.reviews : [];
    main().innerHTML = `
    <h1 class="mb-3">Recensioni</h1>
    <div class="glass" style="padding:0.4rem 1.2rem;">
      <table><thead><tr><th>Prodotto</th><th>Utente</th><th>Voto</th><th>Stato</th><th></th></tr></thead>
      <tbody>${reviews.map(rv => `<tr><td>${rv.product_title}</td><td>${rv.user_name || '—'}</td><td>&#9733; ${rv.rating}</td>
        <td><span class="badge ${rv.status === 'approved' ? 'badge-success' : rv.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">${rv.status}</span></td>
        <td class="flex gap-1"><button class="btn btn-ghost btn-sm" data-approve="${rv.id}">Approva</button><button class="btn btn-ghost btn-sm" data-reject="${rv.id}">Rifiuta</button></td></tr>`).join('') || '<tr><td colspan="5" class="text-muted">Nessuna recensione.</td></tr>'}
      </tbody></table>
    </div>`;
    document.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', async () => { await ESH.api('/api/admin/reviews/' + b.dataset.approve, { method: 'PUT', body: { status: 'approved' } }); renderReviews(); }));
    document.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', async () => { await ESH.api('/api/admin/reviews/' + b.dataset.reject, { method: 'PUT', body: { status: 'rejected' } }); renderReviews(); }));
  }

  // ---------------- TICKET ----------------
  async function renderTickets() {
    const r = await ESH.api('/api/admin/tickets');
    const tickets = r.ok ? r.data.tickets : [];
    main().innerHTML = `
    <h1 class="mb-3">Ticket di supporto</h1>
    <div class="glass" style="padding:0.4rem 1.2rem;">
      <table><thead><tr><th>Oggetto</th><th>Cliente</th><th>Stato</th><th></th></tr></thead>
      <tbody>${tickets.map(t => `<tr><td>${t.subject}</td><td>${t.user_name || t.user_email || '—'}</td><td><span class="badge badge-muted">${t.status}</span></td><td><button class="btn btn-ghost btn-sm" data-ticket="${t.id}">Rispondi</button></td></tr>`).join('') || '<tr><td colspan="4" class="text-muted">Nessun ticket.</td></tr>'}
      </tbody></table>
    </div>`;
    tickets.forEach(t => document.querySelector(`[data-ticket="${t.id}"]`).addEventListener('click', () => openTicketModal(t)));
  }

  function openTicketModal(t) {
    const modal = createModal(`Ticket: ${t.subject}`, `<div class="field"><label>Risposta</label><textarea id="trMessage" rows="4"></textarea></div>`, 'Invia risposta');
    modal.confirmBtn.addEventListener('click', async () => {
      const res = await ESH.api(`/api/admin/tickets/${t.id}/reply`, { method: 'POST', body: { message: val('trMessage'), status: 'answered' } });
      if (!res.ok) return ESH.toast(res.error, 'error');
      ESH.toast('Risposta inviata.', 'success'); closeModal(); renderTickets();
    });
  }

  // ---------------- IMPOSTAZIONI ----------------
  async function renderSettings() {
    const r = await ESH.api('/api/admin/settings');
    const s = r.ok ? r.data.settings : {};
    main().innerHTML = `
    <h1 class="mb-3">Impostazioni negozio</h1>
    <div class="glass" style="padding:1.6rem; max-width:520px;">
      <div class="field"><label>Nome negozio</label><input id="sName" value="${s.store_name || ''}"></div>
      <div class="field"><label>Valuta</label><input id="sCurrency" value="${s.currency || 'EUR'}"></div>
      <div class="field"><label>Lingua predefinita</label><select id="sLang">
        ${['it', 'en', 'es', 'fr'].map(l => `<option value="${l}" ${s.default_language === l ? 'selected' : ''}>${l.toUpperCase()}</option>`).join('')}
      </select></div>
      <div class="field"><label class="checkbox-row"><input type="checkbox" id="sMaintenance" ${s.maintenance_mode === '1' ? 'checked' : ''}> Modalita manutenzione</label></div>
      <button class="btn btn-primary" id="sSave">Salva impostazioni</button>
    </div>`;
    document.getElementById('sSave').addEventListener('click', async () => {
      const body = { store_name: val('sName'), currency: val('sCurrency'), default_language: val('sLang'), maintenance_mode: document.getElementById('sMaintenance').checked ? '1' : '0' };
      const res = await ESH.api('/api/admin/settings', { method: 'PUT', body });
      ESH.toast(res.ok ? 'Impostazioni salvate.' : res.error, res.ok ? 'success' : 'error');
    });
  }

  // ---------------- MODAL HELPER ----------------
  function createModal(title, bodyHtml, confirmLabel) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:1000; display:flex; align-items:center; justify-content:center; padding:1.5rem;';
    overlay.innerHTML = `
      <div class="glass-strong" style="max-width:560px; width:100%; max-height:88vh; overflow-y:auto; padding:1.8rem;">
        <div class="flex justify-between items-center mb-2"><h3>${title}</h3><button class="icon-btn" id="modalClose">&times;</button></div>
        <div id="modalBody">${bodyHtml}</div>
        <div class="flex justify-between mt-2"><button class="btn btn-ghost" id="modalCancel">Annulla</button><button class="btn btn-primary" id="modalConfirm">${confirmLabel}</button></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.id = 'activeModal';
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalCancel').addEventListener('click', closeModal);
    return { overlay, confirmBtn: document.getElementById('modalConfirm') };
  }
  function closeModal() { const m = document.getElementById('activeModal'); if (m) m.remove(); }

  function val(id) { return document.getElementById(id).value.trim(); }
  function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }

  guard();
})();