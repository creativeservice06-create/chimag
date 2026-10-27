-- Facturi emise automat din magazin (+ storno) și exportul lor pentru SAGA.
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  kind TEXT NOT NULL DEFAULT 'factura',      -- factura | storno
  ref_id INTEGER,                            -- la storno: factura stornată
  series TEXT NOT NULL,
  number INTEGER NOT NULL,
  full_number TEXT NOT NULL,                 -- ex: CHI0001
  token TEXT NOT NULL UNIQUE,                -- link public pentru client
  issued_on TEXT NOT NULL,                   -- YYYY-MM-DD (ora României)
  buyer_json TEXT NOT NULL DEFAULT '{}',
  supplier_json TEXT NOT NULL DEFAULT '{}',
  lines_json TEXT NOT NULL DEFAULT '[]',
  total INTEGER NOT NULL DEFAULT 0,          -- bani, cu TVA
  base_total INTEGER NOT NULL DEFAULT 0,     -- bani, fără TVA
  vat_total INTEGER NOT NULL DEFAULT 0,
  vat_payer INTEGER NOT NULL DEFAULT 0,
  vat_rate REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (series, number),
  UNIQUE (order_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_invoices_issued ON invoices(issued_on);

INSERT OR IGNORE INTO settings(key, value) VALUES ('inv_enabled', '0');
INSERT OR IGNORE INTO settings(key, value) VALUES ('inv_series', 'CHI');
INSERT OR IGNORE INTO settings(key, value) VALUES ('inv_start', '1');
INSERT OR IGNORE INTO settings(key, value) VALUES ('inv_trigger', 'expediata');
INSERT OR IGNORE INTO settings(key, value) VALUES ('inv_vat_payer', '0');
INSERT OR IGNORE INTO settings(key, value) VALUES ('inv_vat_rate', '21');
INSERT OR IGNORE INTO settings(key, value) VALUES ('company_bank', '');
INSERT OR IGNORE INTO settings(key, value) VALUES ('company_iban', '');
INSERT OR IGNORE INTO settings(key, value) VALUES ('company_capital', '');
INSERT OR IGNORE INTO settings(key, value) VALUES ('inv_since', '');
