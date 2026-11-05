-- Activitate pe site: o linie pentru fiecare pagină văzută (fără cookie-uri, vizitator anonim pe zi)
CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pv TEXT NOT NULL UNIQUE,
  vid TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_at TEXT NOT NULL DEFAULT (datetime('now')),
  path TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  campaign TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  os TEXT NOT NULL DEFAULT '',
  browser TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  secs INTEGER NOT NULL DEFAULT 0,
  scrolled INTEGER NOT NULL DEFAULT 0,
  is_bot INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_visits_created ON visits(created_at);
CREATE INDEX IF NOT EXISTS idx_visits_last ON visits(last_at);
CREATE INDEX IF NOT EXISTS idx_visits_vid ON visits(vid, id);
