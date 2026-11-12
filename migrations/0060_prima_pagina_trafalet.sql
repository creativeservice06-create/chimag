-- Prima pagină: trafaletul în tile-ul mare, Capybara în locul blenderului (ordinea: trafalet, Capybara, cafetieră, blender, restul)
UPDATE products SET featured = 1, sort = -40 WHERE slug = 'trafalet-magic-cu-rezervor';
UPDATE products SET sort = -30 WHERE slug = 'lampa-de-veghe-capybara';
UPDATE products SET sort = -20 WHERE slug = 'cafetiera-espresso-manuala-portabila';
UPDATE products SET sort = -10 WHERE slug = 'blender-portabil-reincarcabil-usb';
