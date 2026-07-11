// src/db.js
// Database layer — usa node:sqlite (nativo in Node 22+, nessuna dipendenza esterna
// necessaria: utile perche' questo ambiente non ha accesso alla rete per "npm install").
'use strict';

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'data', 'executiveshop.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer', -- customer | admin
  is_verified INTEGER NOT NULL DEFAULT 0,
  two_fa_enabled INTEGER NOT NULL DEFAULT 0,
  two_fa_secret TEXT,
  wallet_balance REAL NOT NULL DEFAULT 0,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  label TEXT, line1 TEXT NOT NULL, line2 TEXT, city TEXT NOT NULL,
  state TEXT, postal_code TEXT NOT NULL, country TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  icon TEXT, image TEXT, sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS api_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, api_key TEXT, api_secret TEXT,
  endpoint TEXT, webhook_url TEXT, auth_method TEXT DEFAULT 'bearer',
  rate_limit INTEGER DEFAULT 60, status TEXT NOT NULL DEFAULT 'disabled', -- enabled|disabled
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  brand TEXT, type TEXT NOT NULL DEFAULT 'physical', -- digital | physical
  price REAL NOT NULL, discount_price REAL, cost REAL,
  sku TEXT UNIQUE, stock INTEGER NOT NULL DEFAULT 0,
  unlimited_stock INTEGER NOT NULL DEFAULT 0,
  thumbnail TEXT, gallery TEXT, tags TEXT, specifications TEXT,
  digital_file_url TEXT, delivery_type TEXT DEFAULT 'none', -- none|file|license_key|api
  api_provider_id INTEGER REFERENCES api_providers(id) ON DELETE SET NULL,
  download_limit INTEGER DEFAULT 0,
  shipping_weight REAL, shipping_size TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft|published|archived|hidden
  seo_title TEXT, seo_description TEXT, seo_keywords TEXT,
  featured INTEGER NOT NULL DEFAULT 0, trending INTEGER NOT NULL DEFAULT 0,
  recommended INTEGER NOT NULL DEFAULT 0, new_arrival INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS license_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  key_value TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available', -- available|used
  order_id INTEGER
);

CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL, type TEXT NOT NULL, -- percentage|fixed|free_shipping
  value REAL NOT NULL DEFAULT 0, usage_limit INTEGER, used_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT, min_order REAL, max_order REAL, status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, network TEXT NOT NULL, address TEXT NOT NULL,
  min_amount REAL DEFAULT 0, max_amount REAL, auto_verify INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS payment_gateways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  public_key TEXT, secret_key TEXT, status TEXT NOT NULL DEFAULT 'disabled'
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|processing|shipped|delivered|cancelled|refunded
  payment_status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid|pending_verification|paid|refunded|failed
  payment_method TEXT, wallet_id INTEGER REFERENCES wallets(id) ON DELETE SET NULL,
  subtotal REAL NOT NULL, discount REAL NOT NULL DEFAULT 0, tax REAL NOT NULL DEFAULT 0,
  shipping_cost REAL NOT NULL DEFAULT 0, total REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR',
  coupon_code TEXT, shipping_address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
  tracking_number TEXT, carrier TEXT, notes TEXT,
  gateway_order_id TEXT, crypto_expected_amount REAL, crypto_network TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  title TEXT NOT NULL, price REAL NOT NULL, quantity INTEGER NOT NULL DEFAULT 1, type TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL, comment TEXT, status TEXT NOT NULL DEFAULT 'pending',
  verified_purchase INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ticket_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL, message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS wishlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  amount REAL NOT NULL, type TEXT NOT NULL, -- credit|debit
  reason TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER, action TEXT NOT NULL, meta TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT
);
`;

db.exec(SCHEMA);

// ---------- helpers ----------
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function seedIfEmpty() {
  const row = db.prepare('SELECT COUNT(*) as c FROM users').get();
  if (row.c > 0) return;

  console.log('Seeding demo data...');

  const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('store_name', 'ExecutiveShop');
  insertSetting.run('currency', 'EUR');
  insertSetting.run('maintenance_mode', '0');
  insertSetting.run('default_language', 'it');

  const admin = hashPassword('Admin#2026!');
  db.prepare(`INSERT INTO users (email, password_hash, salt, name, role, is_verified) VALUES (?,?,?,?,?,1)`)
    .run('admin@executiveshop.test', admin.hash, admin.salt, 'Amministratore', 'admin');

  const cust = hashPassword('Customer#2026!');
  db.prepare(`INSERT INTO users (email, password_hash, salt, name, role, is_verified) VALUES (?,?,?,?,?,1)`)
    .run('cliente@executiveshop.test', cust.hash, cust.salt, 'Mario Rossi', 'customer');

  const catStmt = db.prepare('INSERT INTO categories (name, slug, icon, sort_order) VALUES (?,?,?,?)');
  const categories = [
    ['Software & Licenze', 'software-licenze', 'cpu', 1],
    ['Corsi Digitali', 'corsi-digitali', 'book', 2],
    ['Elettronica', 'elettronica', 'device', 3],
    ['Accessori', 'accessori', 'tag', 4]
  ];
  const catIds = {};
  for (const [name, slug, icon, sort] of categories) {
    const r = catStmt.run(name, slug, icon, sort);
    catIds[slug] = Number(r.lastInsertRowid);
  }

  const apiProv = db.prepare(`INSERT INTO api_providers (name, api_key, api_secret, endpoint, auth_method, status)
    VALUES (?,?,?,?,?,?)`)
    .run('LicenseVault (demo)', 'demo_key_123', 'demo_secret_456', 'https://api.example-provider.test/v1/deliver', 'bearer', 'disabled');
  const apiProvId = Number(apiProv.lastInsertRowid);

  const prodStmt = db.prepare(`INSERT INTO products
    (title, slug, description, category_id, brand, type, price, discount_price, cost, sku, stock, unlimited_stock,
     thumbnail, gallery, tags, specifications, digital_file_url, delivery_type, api_provider_id, download_limit,
     shipping_weight, shipping_size, status, seo_title, seo_description, seo_keywords,
     featured, trending, recommended, new_arrival, visibility)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const products = [
    {
      title: 'Licenza Pro Suite 2026', slug: 'licenza-pro-suite-2026',
      description: 'Licenza annuale per la suite professionale, consegna automatica via chiave.',
      category_id: catIds['software-licenze'], brand: 'ExecutiveShop', type: 'digital',
      price: 89, discount_price: 69, cost: 20, sku: 'ESH-DIG-001', stock: 0, unlimited_stock: 1,
      thumbnail: '', gallery: '[]', tags: '["software","licenza","produttivita"]', specifications: '{"Durata":"12 mesi","Attivazioni":"3 dispositivi"}',
      digital_file_url: '', delivery_type: 'license_key', api_provider_id: null, download_limit: 5,
      shipping_weight: null, shipping_size: null, status: 'published',
      seo_title: 'Licenza Pro Suite 2026', seo_description: 'Attivazione immediata dopo il pagamento.', seo_keywords: 'licenza,software',
      featured: 1, trending: 1, recommended: 0, new_arrival: 1, visibility: 'public'
    },
    {
      title: 'Corso: Fondamenti di Node.js', slug: 'corso-fondamenti-nodejs',
      description: 'Corso completo in italiano su Node.js, con accesso a vita.',
      category_id: catIds['corsi-digitali'], brand: 'ExecutiveShop Academy', type: 'digital',
      price: 49, discount_price: null, cost: 5, sku: 'ESH-DIG-002', stock: 0, unlimited_stock: 1,
      thumbnail: '', gallery: '[]', tags: '["corso","nodejs","programmazione"]', specifications: '{"Ore":"12h","Livello":"Principiante"}',
      digital_file_url: '/downloads/corso-nodejs.zip', delivery_type: 'file', api_provider_id: null, download_limit: 10,
      shipping_weight: null, shipping_size: null, status: 'published',
      seo_title: 'Corso Node.js', seo_description: 'Impara Node.js da zero.', seo_keywords: 'corso,nodejs',
      featured: 1, trending: 0, recommended: 1, new_arrival: 0, visibility: 'public'
    },
    {
      title: 'Cuffie Executive ANC', slug: 'cuffie-executive-anc',
      description: 'Cuffie over-ear con cancellazione attiva del rumore.',
      category_id: catIds['elettronica'], brand: 'ExecutiveShop', type: 'physical',
      price: 179, discount_price: 149, cost: 70, sku: 'ESH-PHY-001', stock: 34, unlimited_stock: 0,
      thumbnail: '', gallery: '[]', tags: '["audio","cuffie"]', specifications: '{"Autonomia":"30h","Bluetooth":"5.3"}',
      digital_file_url: '', delivery_type: 'none', api_provider_id: null, download_limit: 0,
      shipping_weight: 0.35, shipping_size: '20x18x9cm', status: 'published',
      seo_title: 'Cuffie Executive ANC', seo_description: 'Audio premium, silenzio totale.', seo_keywords: 'cuffie,audio',
      featured: 1, trending: 1, recommended: 1, new_arrival: 0, visibility: 'public'
    },
    {
      title: 'Zaino Executive Carbon', slug: 'zaino-executive-carbon',
      description: 'Zaino da lavoro con scomparto imbottito per laptop 16".',
      category_id: catIds['accessori'], brand: 'ExecutiveShop', type: 'physical',
      price: 119, discount_price: null, cost: 45, sku: 'ESH-PHY-002', stock: 12, unlimited_stock: 0,
      thumbnail: '', gallery: '[]', tags: '["zaino","lavoro"]', specifications: '{"Capacita":"24L","Materiale":"Nylon balistico"}',
      digital_file_url: '', delivery_type: 'none', api_provider_id: null, download_limit: 0,
      shipping_weight: 0.9, shipping_size: '48x32x18cm', status: 'published',
      seo_title: 'Zaino Executive Carbon', seo_description: 'Stile e resistenza per il lavoro.', seo_keywords: 'zaino,accessori',
      featured: 0, trending: 0, recommended: 1, new_arrival: 1, visibility: 'public'
    },
    {
      title: 'Chiave API Automazione (via provider)', slug: 'chiave-api-automazione',
      description: 'Consegna automatica tramite provider esterno collegato (demo).',
      category_id: catIds['software-licenze'], brand: 'ExecutiveShop', type: 'digital',
      price: 39, discount_price: null, cost: 8, sku: 'ESH-DIG-003', stock: 0, unlimited_stock: 1,
      thumbnail: '', gallery: '[]', tags: '["api","automazione"]', specifications: '{"Consegna":"Automatica via API"}',
      digital_file_url: '', delivery_type: 'api', api_provider_id: apiProvId, download_limit: 1,
      shipping_weight: null, shipping_size: null, status: 'draft',
      seo_title: 'Chiave API Automazione', seo_description: 'Consegna automatica via provider esterno.', seo_keywords: 'api',
      featured: 0, trending: 0, recommended: 0, new_arrival: 1, visibility: 'public'
    }
  ];

  const prodIds = {};
  for (const p of products) {
    const r = prodStmt.run(
      p.title, p.slug, p.description, p.category_id, p.brand, p.type, p.price, p.discount_price, p.cost,
      p.sku, p.stock, p.unlimited_stock, p.thumbnail, p.gallery, p.tags, p.specifications,
      p.digital_file_url, p.delivery_type, p.api_provider_id, p.download_limit,
      p.shipping_weight, p.shipping_size, p.status, p.seo_title, p.seo_description, p.seo_keywords,
      p.featured, p.trending, p.recommended, p.new_arrival, p.visibility
    );
    prodIds[p.slug] = Number(r.lastInsertRowid);
  }

  const lkStmt = db.prepare('INSERT INTO license_keys (product_id, key_value, status) VALUES (?,?,?)');
  for (let i = 0; i < 20; i++) {
    lkStmt.run(prodIds['licenza-pro-suite-2026'], 'PRO-' + crypto.randomBytes(4).toString('hex').toUpperCase(), 'available');
  }

  db.prepare('INSERT INTO coupons (code, type, value, usage_limit, min_order, status) VALUES (?,?,?,?,?,?)')
    .run('BENVENUTO10', 'percentage', 10, 100, 20, 'active');
  db.prepare('INSERT INTO coupons (code, type, value, usage_limit, min_order, status) VALUES (?,?,?,?,?,?)')
    .run('SPEDIZIONEGRATIS', 'free_shipping', 0, 50, 0, 'active');

  const walletStmt = db.prepare(`INSERT INTO wallets (name, network, address, min_amount, max_amount, auto_verify, status)
    VALUES (?,?,?,?,?,?,?)`);
  walletStmt.run('Bitcoin', 'BTC', 'bc1qqkl35zull7py2zt8fvugxh0hs6elarxuzwcmka', 10, null, 0, 'active');
  walletStmt.run('Litecoin', 'LTC', 'LSEjnWc4NTWz9s3Sy7KsNFPk6DakAJAkaX', 5, null, 0, 'active');

  const gwStmt = db.prepare(`INSERT INTO payment_gateways (code, name, public_key, secret_key, status) VALUES (?,?,?,?,?)`);
  gwStmt.run('paypal_manual', 'PayPal', '', '', 'enabled');
  gwStmt.run('revolut_manual', 'Revolut', '', '', 'enabled');
  gwStmt.run('crypto_manual', 'Crypto (BTC/LTC)', '', '', 'enabled');

  console.log('Seed completato.');
  console.log('Admin login: admin@executiveshop.test / Admin#2026!');
  console.log('Cliente demo: cliente@executiveshop.test / Customer#2026!');
}

seedIfEmpty();

module.exports = { db, hashPassword };

if (require.main === module) {
  // node src/db.js --seed  (forza check seed, utile per script npm run seed)
  console.log('Database pronto in', DB_PATH);
}