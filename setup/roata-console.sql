CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT DEFAULT '',
  type TEXT NOT NULL,
  value INTEGER DEFAULT 0,
  min_order INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  expires_at TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  source TEXT DEFAULT 'manual',
  ip TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_coupons_source ON coupons(source, created_at);
ALTER TABLE orders ADD COLUMN coupon_code TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN coupon_discount INTEGER DEFAULT 0;
INSERT OR IGNORE INTO settings(key, value) VALUES
 ('wheel_enabled', '1'),
 ('wheel_auto_open', '1'),
 ('wheel_delay', '5'),
 ('wheel_hours', '48'),
 ('wheel_title', 'Învârte roata și câștigă o reducere'),
 ('wheel_prizes', '[{"label":"Transport gratuit","type":"transport","value":0,"weight":35,"min":0},{"label":"10% reducere","type":"procent","value":10,"weight":25,"min":0},{"label":"15 lei reducere","type":"lei","value":1500,"weight":20,"min":10000},{"label":"1+1 gratis","type":"1plus1","value":0,"weight":5,"min":0},{"label":"15% reducere","type":"procent","value":15,"weight":10,"min":0},{"label":"20% reducere","type":"procent","value":20,"weight":5,"min":0}]');
