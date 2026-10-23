-- Formular de contact, setări noi, date firmă, roata cu șansă de „fără premiu"

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  order_number TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  message TEXT NOT NULL,
  ip TEXT DEFAULT '',
  is_read INTEGER DEFAULT 0,
  emailed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

INSERT OR IGNORE INTO settings(key, value) VALUES
 ('contact_email', 'chirilasadrian@yahoo.com'),
 ('notify_orders', '1'),
 ('whatsapp', ''),
 ('facebook_url', ''),
 ('instagram_url', ''),
 ('tiktok_url', '');

UPDATE settings SET value = 'HARD SERVICE SRL' WHERE key = 'company_name' AND (value = '' OR value = 'NUMELE FIRMEI SRL');
UPDATE settings SET value = '5451133' WHERE key = 'company_cui' AND (value = '' OR value = 'ROxxxxxxxx');
UPDATE settings SET value = '0740 231 358' WHERE key = 'phone' AND (value = '' OR value = '07xx xxx xxx');
UPDATE settings SET value = '0740 231 358' WHERE key = 'sender_phone' AND value = '';
UPDATE settings SET value = '' WHERE key = 'company_reg' AND value = 'J40/xxxx/20xx';
UPDATE settings SET value = '' WHERE key = 'company_address' AND value = 'Strada, nr., localitate, județ';
UPDATE settings SET value = '' WHERE key = 'email' AND value = 'contact@chimag.ro';

UPDATE settings SET value = '[{"label":"Transport gratuit","type":"transport","value":0,"weight":28,"min":0},{"label":"10% reducere","type":"procent","value":10,"weight":20,"min":0},{"label":"Mai încearcă","type":"nimic","value":0,"weight":22,"min":0},{"label":"15 lei reducere","type":"lei","value":1500,"weight":15,"min":10000},{"label":"1+1 gratis","type":"1plus1","value":0,"weight":4,"min":0},{"label":"15% reducere","type":"procent","value":15,"weight":8,"min":0},{"label":"20% reducere","type":"procent","value":20,"weight":3,"min":0}]' WHERE key = 'wheel_prizes' AND value = '[{"label":"Transport gratuit","type":"transport","value":0,"weight":35,"min":0},{"label":"10% reducere","type":"procent","value":10,"weight":25,"min":0},{"label":"15 lei reducere","type":"lei","value":1500,"weight":20,"min":10000},{"label":"1+1 gratis","type":"1plus1","value":0,"weight":5,"min":0},{"label":"15% reducere","type":"procent","value":15,"weight":10,"min":0},{"label":"20% reducere","type":"procent","value":20,"weight":5,"min":0}]';
