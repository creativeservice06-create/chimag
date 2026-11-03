-- Trafalet magic: poze fără marca furnizorului (fișiere noi, ca să nu rămână cele vechi în cache)
UPDATE products SET images = REPLACE(images, '/img/trafalet-magic-', '/img/trafalet-v2-'),
  sections = REPLACE(sections, '/img/trafalet-magic-', '/img/trafalet-v2-')
WHERE slug = 'trafalet-magic-cu-rezervor';
