-- Cereri de retragere / retur trimise de clienți din site (OUG 34/2014 + OUG 18/2026)
CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  items TEXT NOT NULL DEFAULT '[]',
  amount INTEGER NOT NULL DEFAULT 0,
  full_return INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  iban TEXT NOT NULL DEFAULT '',
  holder TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'noua',
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  received_at TEXT NOT NULL DEFAULT '',
  refunded_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status, created_at);
