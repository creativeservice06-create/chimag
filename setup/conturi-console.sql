CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT DEFAULT '',
  password_hash TEXT DEFAULT '',
  email_verified INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  token_hash TEXT DEFAULT '',
  token_type TEXT DEFAULT '',
  token_expires TEXT DEFAULT '',
  county TEXT DEFAULT '',
  city TEXT DEFAULT '',
  address TEXT DEFAULT '',
  postal_code TEXT DEFAULT '',
  admin_notes TEXT DEFAULT '',
  last_login TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS customer_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customer_events ON customer_events(customer_id);
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  k TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(k, created_at);
ALTER TABLE orders ADD COLUMN customer_id INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
INSERT OR IGNORE INTO settings(key, value) VALUES
 ('accounts_enabled', '1'),
 ('customer_emails', '1');
