-- Roata norocului apare singură după 20 de secunde (în loc de 5), ca vizitatorii veniți
-- din reclame să apuce să vadă produsul și să răspundă la bannerul de cookie-uri.
-- Valoarea se poate schimba oricând din admin: Roată și coduri → „Apare după (secunde)".
INSERT INTO settings (key, value) VALUES ('wheel_delay', '20')
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
