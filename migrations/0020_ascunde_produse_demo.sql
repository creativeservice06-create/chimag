-- Produsele demo de la instalare nu mai apar pe site (rămân în baza de date, ascunse, ca să nu se strice comenzile vechi de test)
UPDATE products SET active = 0, featured = 0
WHERE slug IN ('lampa-birou-incarcare-wireless', 'set-organizatoare-sertar', 'termos-inox-750', 'perna-cervicala-memory')
  AND description LIKE 'PRODUS DEMO%';
