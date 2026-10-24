ALTER TABLE coupons ADD COLUMN customer_id INTEGER DEFAULT 0;
ALTER TABLE coupons ADD COLUMN stage INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_coupons_customer ON coupons(customer_id, source);
ALTER TABLE customers ADD COLUMN wheel_notified INTEGER DEFAULT 0;
UPDATE settings SET value = '2' WHERE key = 'wheel_hours';
INSERT OR IGNORE INTO settings(key, value) VALUES ('wheel_min_third', '25000');
