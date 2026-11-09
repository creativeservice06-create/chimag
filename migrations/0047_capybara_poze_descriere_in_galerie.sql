-- Capybara: adaugă în galeria principală și pozele din descriere (secțiuni), fără dubluri, fără poza pe fundal alb
UPDATE products SET images = (
  SELECT json_group_array(v) FROM (
    SELECT v, MIN(src * 100 + k) AS o FROM (
      SELECT value AS v, 0 AS src, CAST(key AS INTEGER) AS k FROM json_each(products.images)
      UNION ALL
      SELECT json_extract(value, '$.image') AS v, 1 AS src, CAST(key AS INTEGER) AS k FROM json_each(products.sections)
      WHERE json_extract(value, '$.image') LIKE '/img/%'
    )
    WHERE v IS NOT NULL AND v != '' AND v != '/img/lampa-capybara-2.jpg'
    GROUP BY v
    ORDER BY CASE v
      WHEN '/img/lampa-capybara-1.jpg' THEN 0 WHEN '/img/lampa-capybara-6.jpg' THEN 1 WHEN '/img/lampa-capybara-somn.jpg' THEN 2
      WHEN '/img/lampa-capybara-3.jpg' THEN 3 WHEN '/img/lampa-capybara-9.jpg' THEN 4 ELSE 5 END, o
  )
)
WHERE slug = 'lampa-de-veghe-capybara' AND json_valid(images) AND json_valid(sections);
