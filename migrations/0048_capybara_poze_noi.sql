-- Poză separată pentru caseta mare de pe prima pagină (gol = prima poză a produsului)
ALTER TABLE products ADD COLUMN hero_image TEXT NOT NULL DEFAULT '';
-- Capybara: poze noi la început (cutie, în mâini, pe birou), fără primele două de până acum (1 și 6)
UPDATE products SET
  images = (
    SELECT json_group_array(v) FROM (
      SELECT v FROM (
        SELECT '/img/lampa-capybara-cutie.jpg' AS v, 0 AS o
        UNION ALL SELECT '/img/lampa-capybara-maini.jpg', 1
        UNION ALL SELECT '/img/lampa-capybara-birou.jpg', 2
        UNION ALL SELECT value, 10 + CAST(key AS INTEGER) FROM json_each(products.images)
          WHERE value NOT IN ('/img/lampa-capybara-1.jpg', '/img/lampa-capybara-6.jpg', '/img/lampa-capybara-cutie.jpg', '/img/lampa-capybara-maini.jpg', '/img/lampa-capybara-birou.jpg')
      ) ORDER BY o
    )
  ),
  hero_image = '/img/lampa-capybara-maini.jpg'
WHERE slug = 'lampa-de-veghe-capybara' AND json_valid(images);
