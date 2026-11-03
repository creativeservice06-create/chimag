-- Trafalet magic: 1 buc. 49 lei, 2 buc. 79 lei, 3 buc. 99 lei
UPDATE products SET bundles = '[{"qty": 1, "pct": 0, "label": ""}, {"qty": 2, "pct": 19.387755, "label": "Cel mai ales"}, {"qty": 3, "pct": 32.653061, "label": "Cea mai bună ofertă"}]'
WHERE slug = 'trafalet-magic-cu-rezervor';
