-- Capybara: prima poză = lampa aprinsă (1), apoi în mâini (6); scoasă poza pe fundal alb (2). Restul pozelor rămân în ordinea lor.
UPDATE products SET images = (
  SELECT json_group_array(value) FROM (
    SELECT value FROM json_each(products.images)
    WHERE value != '/img/lampa-capybara-2.jpg'
    ORDER BY CASE value WHEN '/img/lampa-capybara-1.jpg' THEN 0 WHEN '/img/lampa-capybara-6.jpg' THEN 1 ELSE 2 END, key
  )
)
WHERE slug = 'lampa-de-veghe-capybara' AND json_valid(images);
