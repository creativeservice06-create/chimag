-- Trafalet: 1 buc. 59 lei, 2 buc. 89 lei, 3 buc. 119 lei (aceeași structură ca la Capybara)
-- 2 × 59 = 118 → 89 lei (−24,576271%); 3 × 59 = 177 → 119 lei (−32,768362%)
UPDATE products SET price = 5900, compare_at_price = 0,
  bundles = '[{"qty": 1, "pct": 0, "label": ""}, {"qty": 2, "pct": 24.576271, "label": "Cel mai ales"}, {"qty": 3, "pct": 32.768362, "label": "Cea mai bună ofertă"}]'
WHERE slug = 'trafalet-magic-cu-rezervor';
