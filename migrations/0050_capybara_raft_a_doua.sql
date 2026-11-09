-- Capybara: poza pe raft (între cărți) mutată pe locul 2 în galerie
UPDATE products SET images = (
  SELECT json_group_array(value) FROM (
    SELECT value FROM json_each(products.images)
    ORDER BY CASE WHEN CAST(key AS INTEGER) = 0 THEN 0 WHEN value = '/img/lampa-capybara-7.jpg' THEN 1 ELSE 2 END, CAST(key AS INTEGER)
  )
) WHERE slug = 'lampa-de-veghe-capybara' AND json_valid(images) AND images LIKE '%lampa-capybara-7.jpg%';
