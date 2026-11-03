-- Video de prezentare pe pagina de produs (pornește singur, fără sunet, în buclă)
ALTER TABLE products ADD COLUMN video TEXT NOT NULL DEFAULT '';
UPDATE products SET video = '/video/trafalet-magic.mp4' WHERE slug = 'trafalet-magic-cu-rezervor';
