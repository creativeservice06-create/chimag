INSERT INTO settings (key, value) VALUES ('email', 'chimag.contact@gmail.com') ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE settings.value = '';
