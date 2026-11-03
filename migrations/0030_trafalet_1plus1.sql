-- Trafalet magic: ofertă 1+1 gratuit (2 buc. = 69 lei), 3 buc. = 89 lei; fără preț tăiat
UPDATE products SET compare_at_price = 0,
  bundles = '[{"qty": 1, "pct": 0, "label": ""}, {"qty": 2, "pct": 50, "label": "1+1 GRATUIT"}, {"qty": 3, "pct": 57.004831, "label": "Cea mai bună ofertă"}]'
WHERE slug = 'trafalet-magic-cu-rezervor';
