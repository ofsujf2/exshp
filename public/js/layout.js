// public/js/layout.js
window.ESH = window.ESH || {};

const ICONS = {
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.9 3.1-6.4 7-6.4s7 2.5 7 6.4"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.6-3.6"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20s-7-4.3-9.3-8.7C1.2 8 3 5 6.3 5c2 0 3.4 1.1 4.2 2.3C11.3 6.1 12.7 5 14.7 5 18 5 19.8 8 18.3 11.3 16 15.7 12 20 12 20Z"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 17l5-5-5-5M20 12H9M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/></svg>'
};
ESH.icon = (name) => ICONS[name] || '';

const NAV_LINKS = [
  { href: '/products.html', key: 'nav_products', label: 'Prodotti' },
  { href: '/categories.html', key: 'nav_categories', label: 'Categorie' },
  { href: '/about.html', key: 'nav_about', label: 'Chi siamo' },
  { href: '/contact.html', key: 'nav_contact', label: 'Contatti' }
];

function navHtml(active) {
  const links = NAV_LINKS.map(l => `<a href="${l.href}" class="${active === l.href ? 'active' : ''}" data-i18n="${l.key}">${l.label}</a>`).join('');
  return `
  <nav class="navbar" id="navbar">
    <a href="/" class="nav-logo"><span class="dot"></span>ExecutiveShop</a>
    <div class="nav-links">${links}</div>
    <div class="nav-actions">
      <select class="lang-select" id="langSelect" aria-label="Lingua">
        <option value="it">IT</option><option value="en">EN</option><option value="es">ES</option><option value="fr">FR</option>
      </select>
      <a href="/search.html" class="icon-btn" title="Cerca">${ICONS.search}</a>
      <a href="/wishlist.html" class="icon-btn" title="Wishlist">${ICONS.heart}</a>
      <a href="/cart.html" class="icon-btn" title="Carrello" id="cartBtn">${ICONS.bag}<span class="cart-badge hidden" id="cartBadge">0</span></a>
      <a href="/login.html" class="icon-btn" title="Account" id="accountBtn">${ICONS.user}</a>
      <button class="icon-btn menu-toggle" id="menuToggle">${ICONS.menu}</button>
    </div>
  </nav>`;
}

function footerHtml() {
  return `
  <footer>
    <div class="container">
      <div class="footer-grid">
        <div>
          <a href="/" class="nav-logo mb-1"><span class="dot"></span>ExecutiveShop</a>
          <p class="text-muted" style="max-width:32ch; font-size:0.88rem; line-height:1.7;">Piattaforma premium per beni digitali e fisici. Pagamenti con carta, PayPal, Revolut e crypto.</p>
        </div>
        <div class="footer-col">
          <h4 data-i18n="footer_shop">Negozio</h4>
          <a href="/products.html">Tutti i prodotti</a>
          <a href="/products.html?featured=1">In evidenza</a>
          <a href="/products.html?new_arrival=1">Novita</a>
        </div>
        <div class="footer-col">
          <h4 data-i18n="footer_support">Assistenza</h4>
          <a href="/faq.html">FAQ</a>
          <a href="/track-order.html">Traccia ordine</a>
          <a href="/refund-policy.html">Resi e rimborsi</a>
          <a href="/contact.html">Contattaci</a>
        </div>
        <div class="footer-col">
          <h4 data-i18n="footer_legal">Legale</h4>
          <a href="/terms.html">Termini</a>
          <a href="/privacy.html">Privacy</a>
        </div>
        <div class="footer-col">
          <h4>Account</h4>
          <a href="/dashboard.html">Il mio account</a>
          <a href="/login.html">Accedi</a>
          <a href="/register.html">Registrati</a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; 2026 ExecutiveShop. Tutti i diritti riservati.</span>
        <div class="footer-trust">
          <span class="badge badge-muted">${ICONS.lock} Pagamenti protetti</span>
          <span class="badge badge-muted">Carta &middot; PayPal &middot; Revolut &middot; Crypto</span>
        </div>
      </div>
    </div>
  </footer>`;
}

async function mountAuth() {
  const r = await ESH.api('/api/auth/me');
  const btn = document.getElementById('accountBtn');
  if (!btn) return null;
  if (r.ok && r.data.user) {
    const u = r.data.user;
    btn.href = u.role === 'admin' ? '/admin/' : '/dashboard.html';
    btn.title = u.name;
    return u;
  }
  btn.href = '/login.html';
  return null;
}

function mountCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  const update = () => {
    const c = ESH.cart.count();
    badge.textContent = c;
    badge.classList.toggle('hidden', c === 0);
  };
  update();
  document.addEventListener('cart:updated', update);
}

function mountScrollNav() {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 20), { passive: true });
}

function mountMobileMenu() {
  const toggle = document.getElementById('menuToggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => {
    const open = links.style.display === 'flex';
    links.style.cssText = open ? '' : 'display:flex; position:fixed; top:64px; left:0; right:0; flex-direction:column; background:rgba(9,9,9,0.97); padding:1.4rem; gap:1.2rem; backdrop-filter:blur(16px); z-index:150;';
  });
}

async function mountI18n() {
  const select = document.getElementById('langSelect');
  const lang = localStorage.getItem('esh_lang') || 'it';
  if (select) select.value = lang;
  await applyLang(lang);
  if (select) select.addEventListener('change', async (e) => {
    localStorage.setItem('esh_lang', e.target.value);
    await applyLang(e.target.value);
  });
}

async function applyLang(lang) {
  try {
    const res = await fetch(`/locales/${lang}.json`);
    if (!res.ok) return;
    const dict = await res.json();
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) el.textContent = dict[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (dict[key]) el.setAttribute('placeholder', dict[key]);
    });
  } catch { /* i18n opzionale, non blocca la pagina */ }
}

// Effetto "3D" leggero: tilt sulle card al passaggio del mouse (disattivato se l'utente
// preferisce meno animazioni, o su touch).
function mountTilt() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(hover: none)').matches) return;
  document.querySelectorAll('.tilt').forEach(card => {
    card.style.transformStyle = 'preserve-3d';
    card.style.willChange = 'transform';
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(700px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateZ(0)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = 'perspective(700px) rotateX(0) rotateY(0)'; });
  });
}

function mountReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.15 });
  els.forEach(el => io.observe(el));
}

ESH.layout = async function (activePath) {
  document.getElementById('app-nav').innerHTML = navHtml(activePath);
  document.getElementById('app-footer').innerHTML = footerHtml();
  mountScrollNav();
  mountMobileMenu();
  mountCartBadge();
  await mountI18n();
  const user = await mountAuth();
  mountTilt();
  mountReveal();
  return user;
};
