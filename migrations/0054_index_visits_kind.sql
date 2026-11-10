-- căutarea „primul vizitator pentru comanda X” (pagina de mulțumire) folosește index, nu tot tabelul
CREATE INDEX IF NOT EXISTS idx_visits_kind_slug ON visits(kind, slug);
