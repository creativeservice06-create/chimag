-- recenzii primite de la clienți (Marius, Cluj și Valentina, Buzău), cu pozele lor
INSERT INTO reviews (product_id, name, city, rating, text, photo)
SELECT id, 'Marius', 'Cluj', 5, 'Luminează foarte bine, cu o lumină caldă și plăcută. Sunt mulțumit!', '/img/recenzie-capybara-marius.jpg'
FROM products WHERE slug = 'lampa-de-veghe-capybara'
  AND NOT EXISTS (SELECT 1 FROM reviews r JOIN products p ON p.id = r.product_id WHERE p.slug = 'lampa-de-veghe-capybara' AND r.name = 'Marius' AND r.city = 'Cluj');
INSERT INTO reviews (product_id, name, city, rating, text, photo)
SELECT id, 'Valentina', 'Buzău', 5, 'Camera mea are acum o lumină mult mai caldă.', '/img/recenzie-capybara-valentina.jpg'
FROM products WHERE slug = 'lampa-de-veghe-capybara'
  AND NOT EXISTS (SELECT 1 FROM reviews r JOIN products p ON p.id = r.product_id WHERE p.slug = 'lampa-de-veghe-capybara' AND r.name = 'Valentina' AND r.city = 'Buzău');
