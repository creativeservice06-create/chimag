ALTER TABLE orders ADD COLUMN hs_order_id TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN hs_sent_at TEXT NOT NULL DEFAULT '';
INSERT OR IGNORE INTO settings(key, value) VALUES ('helpship_send', 'placed');
