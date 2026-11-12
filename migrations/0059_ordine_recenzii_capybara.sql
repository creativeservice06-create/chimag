-- Ordinea recenziilor la Capybara: Marius, Ana, Valentina (Valentina ultima).
-- Recenziile se afișează de la cea mai nouă (id mare) la cea mai veche, deci rotim conținutul celor 3 rânduri.
UPDATE reviews SET name = 'Valentina', city = 'Buzău', rating = 5, text = 'Camera mea are acum o lumină mult mai caldă.', photo = '/img/recenzie-capybara-valentina.jpg'
WHERE id = (SELECT MIN(r.id) FROM reviews r JOIN products p ON p.id = r.product_id WHERE p.slug = 'lampa-de-veghe-capybara' AND r.name IN ('Ana', 'Marius', 'Valentina'));
UPDATE reviews SET name = 'Marius', city = 'Cluj', rating = 5, text = 'Luminează foarte bine, cu o lumină caldă și plăcută. Sunt mulțumit!', photo = '/img/recenzie-capybara-marius.jpg'
WHERE id = (SELECT MAX(r.id) FROM reviews r JOIN products p ON p.id = r.product_id WHERE p.slug = 'lampa-de-veghe-capybara' AND r.name IN ('Ana', 'Marius', 'Valentina'));
UPDATE reviews SET name = 'Ana', city = 'Oradea', rating = 5, text = 'Copilul meu doarme acum în fiecare seară cu această lampă, ideală pentru cei ce se tem de întuneric :)', photo = '/img/recenzie-capybara-ana.jpg'
WHERE id IN (SELECT r.id FROM reviews r JOIN products p ON p.id = r.product_id WHERE p.slug = 'lampa-de-veghe-capybara' AND r.name IN ('Ana', 'Marius', 'Valentina'))
  AND id NOT IN (SELECT MIN(r.id) FROM reviews r JOIN products p ON p.id = r.product_id WHERE p.slug = 'lampa-de-veghe-capybara' AND r.name IN ('Ana', 'Marius', 'Valentina'))
  AND id NOT IN (SELECT MAX(r.id) FROM reviews r JOIN products p ON p.id = r.product_id WHERE p.slug = 'lampa-de-veghe-capybara' AND r.name IN ('Ana', 'Marius', 'Valentina'));
