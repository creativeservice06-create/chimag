-- corectează vizitele pe pagina comenzii: comandă nouă = comanda plasată cu cel mult 15 minute înainte
UPDATE visits SET slug = COALESCE((SELECT o.number FROM orders o WHERE '/multumim/' || o.token = visits.path), '')
  WHERE kind IN ('multumim', 'status');
UPDATE visits SET kind = CASE WHEN EXISTS (SELECT 1 FROM orders o WHERE '/multumim/' || o.token = visits.path
    AND visits.created_at >= datetime(o.created_at, '-1 minutes') AND visits.created_at <= datetime(o.created_at, '+15 minutes')) THEN 'multumim' ELSE 'status' END
  WHERE kind IN ('multumim', 'status');
