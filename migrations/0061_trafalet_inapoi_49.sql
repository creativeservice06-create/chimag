-- Trafalet: înapoi la 49 / 79 / 99 lei, fără preț tăiat (prețul de 59 a fost doar câteva zile)
-- 2 × 49 = 98 → 79 lei (−19,387755%); 3 × 49 = 147 → 99 lei (−32,653061%)
UPDATE products SET price = 4900, compare_at_price = 0,
  bundles = '[{"qty": 1, "pct": 0, "label": ""}, {"qty": 2, "pct": 19.387755, "label": "Cel mai ales"}, {"qty": 3, "pct": 32.653061, "label": "Cea mai bună ofertă"}]'
WHERE slug = 'trafalet-magic-cu-rezervor';
