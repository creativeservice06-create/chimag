ALTER TABLE order_items ADD COLUMN unit_cost INTEGER NOT NULL DEFAULT 0;
INSERT OR IGNORE INTO settings(key, value) VALUES ('cost_courier', '0');
INSERT OR IGNORE INTO settings(key, value) VALUES ('cost_helpship', '0');
