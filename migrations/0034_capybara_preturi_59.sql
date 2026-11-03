-- Lampa Capybara: 1 buc. 59 lei, 2 buc. 99 lei, 3 buc. 129 lei
UPDATE products SET price = 5900, compare_at_price = 0,
  bundles = '[{"qty": 1, "pct": 0, "label": ""}, {"qty": 2, "pct": 16.101695, "label": "Cel mai ales"}, {"qty": 3, "pct": 27.118644, "label": "Cea mai bună ofertă"}]'
WHERE slug = 'lampa-de-veghe-capybara';
