-- Profit real: costurile lunare introduse manual (reclame, Helpship, alte costuri), în bani
CREATE TABLE IF NOT EXISTS monthly_costs (
  month TEXT PRIMARY KEY,            -- YYYY-MM
  ads INTEGER NOT NULL DEFAULT 0,
  helpship INTEGER NOT NULL DEFAULT 0,
  other INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);
