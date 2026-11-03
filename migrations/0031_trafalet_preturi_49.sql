-- Trafalet magic: 1 buc. 49 lei, 2 buc. 89 lei, 3 buc. 119 lei
UPDATE products SET price = 4900, compare_at_price = 0,
  bundles = '[{"qty": 1, "pct": 0, "label": ""}, {"qty": 2, "pct": 9.183673, "label": "Cel mai ales"}, {"qty": 3, "pct": 19.047619, "label": "Cea mai bună ofertă"}]'
WHERE slug = 'trafalet-magic-cu-rezervor';
