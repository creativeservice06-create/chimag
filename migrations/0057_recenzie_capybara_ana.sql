-- recenzie primită de la client (Ana, Oradea), cu poza ei
INSERT INTO reviews (product_id, name, city, rating, text, photo)
SELECT id, 'Ana', 'Oradea', 5, 'Copilul meu doarme acum în fiecare seară cu această lampă, ideală pentru cei ce se tem de întuneric :)', '/img/recenzie-capybara-ana.jpg'
FROM products WHERE slug = 'lampa-de-veghe-capybara'
  AND NOT EXISTS (SELECT 1 FROM reviews r JOIN products p ON p.id = r.product_id WHERE p.slug = 'lampa-de-veghe-capybara' AND r.name = 'Ana' AND r.city = 'Oradea');
