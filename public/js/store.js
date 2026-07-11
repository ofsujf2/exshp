// public/js/store.js
window.ESH = window.ESH || {};
const CART_KEY = 'esh_cart';

ESH.cart = {
  get() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
  },
  save(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: items }));
  },
  add(product, qty = 1) {
    const items = ESH.cart.get();
    const existing = items.find(i => i.product_id === product.id);
    if (existing) existing.qty += qty;
    else items.push({
      product_id: product.id, title: product.title, slug: product.slug,
      price: product.discount_price ?? product.price, thumbnail: product.thumbnail || '',
      type: product.type, qty
    });
    ESH.cart.save(items);
  },
  updateQty(productId, qty) {
    let items = ESH.cart.get();
    if (qty <= 0) items = items.filter(i => i.product_id !== productId);
    else items = items.map(i => i.product_id === productId ? { ...i, qty } : i);
    ESH.cart.save(items);
  },
  remove(productId) {
    ESH.cart.save(ESH.cart.get().filter(i => i.product_id !== productId));
  },
  clear() { ESH.cart.save([]); },
  count() { return ESH.cart.get().reduce((s, i) => s + i.qty, 0); },
  subtotal() { return +ESH.cart.get().reduce((s, i) => s + i.price * i.qty, 0).toFixed(2); },
  hasPhysical() { return ESH.cart.get().some(i => i.type === 'physical'); }
};
