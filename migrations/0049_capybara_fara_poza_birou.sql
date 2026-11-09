-- Capybara: scoasă poza pe birou (cu creioane) din galerie
UPDATE products SET images = (
  SELECT json_group_array(value) FROM (SELECT value FROM json_each(products.images) WHERE value != '/img/lampa-capybara-birou.jpg' ORDER BY CAST(key AS INTEGER))
) WHERE slug = 'lampa-de-veghe-capybara' AND json_valid(images);
