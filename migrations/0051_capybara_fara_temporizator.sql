-- Capybara: scoase mențiunile despre temporizator (rămâne „mai multe culori”)
UPDATE products SET
  subtitle = replace(subtitle, ', cu temporizator și mai multe culori', ', în mai multe culori'),
  description = replace(description, ' Pornești temporizatorul și se stinge singură după ce copilul a adormit, așa că nu trebuie să intri din nou în cameră.', ''),
  sections = replace(sections, '\n\nPornești temporizatorul, iar lampa se stinge singură după ce cel mic a adormit. Nu mai intri în vârful picioarelor în cameră ca să stingi lumina.', '')
WHERE slug = 'lampa-de-veghe-capybara';
UPDATE products SET benefits = (SELECT json_group_array(value) FROM (SELECT value FROM json_each(products.benefits) WHERE value NOT LIKE '%emporizator%' ORDER BY CAST(key AS INTEGER)))
WHERE slug = 'lampa-de-veghe-capybara' AND json_valid(benefits);
UPDATE products SET faq = (SELECT json_group_array(json(value)) FROM (SELECT value FROM json_each(products.faq) WHERE json_extract(value, '$.q') NOT LIKE '%emporizator%' ORDER BY CAST(key AS INTEGER)))
WHERE slug = 'lampa-de-veghe-capybara' AND json_valid(faq);
UPDATE products SET specs = (SELECT json_group_array(json(value)) FROM (SELECT value FROM json_each(products.specs) WHERE json_extract(value, '$.k') NOT LIKE '%emporizator%' ORDER BY CAST(key AS INTEGER)))
WHERE slug = 'lampa-de-veghe-capybara' AND json_valid(specs);
