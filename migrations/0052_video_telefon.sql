-- Clip scurt afișat doar pe telefon, deasupra secțiunii „Despre produs” (gol = nimic)
ALTER TABLE products ADD COLUMN mobile_video TEXT NOT NULL DEFAULT '';
UPDATE products SET mobile_video = '/video/lampa-capybara-loop.mp4' WHERE slug = 'lampa-de-veghe-capybara';
