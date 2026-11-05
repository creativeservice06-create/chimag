-- o comandă apare ca „A comandat” o singură dată (primul vizitator); celelalte deschideri sunt verificări
UPDATE visits SET kind = 'status'
  WHERE kind = 'multumim' AND slug != ''
  AND vid != (SELECT v2.vid FROM visits v2 WHERE v2.kind = 'multumim' AND v2.slug = visits.slug ORDER BY v2.id LIMIT 1);
