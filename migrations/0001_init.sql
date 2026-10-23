-- chimag.ro – structura bazei de date
-- Toate sumele sunt în BANI (1 leu = 100 bani), ca să evităm erorile de rotunjire.

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  description TEXT DEFAULT '',          -- paragrafe separate prin rând gol
  price INTEGER NOT NULL,               -- preț de vânzare (bani)
  compare_at_price INTEGER DEFAULT 0,   -- preț vechi tăiat (bani), 0 = fără
  cost_price INTEGER DEFAULT 0,         -- cost achiziție (bani), pentru profit în admin
  sku TEXT DEFAULT '',
  stock INTEGER DEFAULT 0,
  track_stock INTEGER DEFAULT 1,
  weight_g INTEGER DEFAULT 500,
  images TEXT DEFAULT '[]',             -- JSON: ["url1","url2"]
  benefits TEXT DEFAULT '[]',           -- JSON: ["beneficiu 1", ...]
  faq TEXT DEFAULT '[]',                -- JSON: [{"q":"","a":""}]
  bundles TEXT DEFAULT '[]',            -- JSON: [{"qty":2,"pct":10,"label":"Cel mai ales"}]
  badge TEXT DEFAULT '',                -- ex: "Best seller"
  category TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  featured INTEGER DEFAULT 0,
  sort INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT DEFAULT '',
  rating INTEGER DEFAULT 5,
  text TEXT NOT NULL,
  approved INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,          -- ex: CHI-1001
  token TEXT NOT NULL UNIQUE,           -- link public pentru client (status comandă)
  status TEXT NOT NULL DEFAULT 'noua',  -- noua, confirmata, expediata, livrata, refuzata, anulata, retur
  payment_method TEXT NOT NULL DEFAULT 'ramburs', -- ramburs | card
  payment_status TEXT NOT NULL DEFAULT 'neplatita', -- neplatita | platita | esuata | rambursata
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  county TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  postal_code TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  admin_notes TEXT DEFAULT '',
  subtotal INTEGER NOT NULL,
  discount INTEGER DEFAULT 0,
  shipping INTEGER DEFAULT 0,
  cod_fee INTEGER DEFAULT 0,
  total INTEGER NOT NULL,
  -- curierat
  shipping_provider TEXT DEFAULT '',
  awb TEXT DEFAULT '',
  courier TEXT DEFAULT '',
  tracking_url TEXT DEFAULT '',
  label_url TEXT DEFAULT '',
  shipping_status TEXT DEFAULT '',
  shipping_error TEXT DEFAULT '',
  -- plată card
  stripe_session_id TEXT DEFAULT '',
  -- marketing
  utm_source TEXT DEFAULT '',
  utm_medium TEXT DEFAULT '',
  utm_campaign TEXT DEFAULT '',
  fbclid TEXT DEFAULT '',
  ttclid TEXT DEFAULT '',
  fbp TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  purchase_tracked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER,
  title TEXT NOT NULL,
  sku TEXT DEFAULT '',
  qty INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  line_discount INTEGER DEFAULT 0,
  total INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
INSERT OR IGNORE INTO counters(name, value) VALUES ('order_number', 1000);
