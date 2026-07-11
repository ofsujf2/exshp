// public/js/api.js
window.ESH = window.ESH || {};

ESH.api = async function (path, { method = 'GET', body, headers } = {}) {
  try {
    const res = await fetch(path, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch { /* risposta vuota */ }
    if (!res.ok) return { ok: false, status: res.status, error: (data && data.error) || 'Errore sconosciuto.' };
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, error: 'Impossibile contattare il server. Il server Node e avviato?' };
  }
};

ESH.formatPrice = function (value, currency = 'EUR') {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(value);
};

ESH.toast = function (message, type = 'info') {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  const el = document.createElement('div');
  el.className = `toast glass alert-${type === 'error' ? 'danger' : type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; setTimeout(() => el.remove(), 400); }, 3200);
};
