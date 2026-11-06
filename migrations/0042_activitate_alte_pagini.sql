-- arată adresa exactă pentru „Altă pagină” și separă căutarea / verificarea comenzii
UPDATE visits SET kind = 'cautare' WHERE kind = 'alta' AND path = '/cautare';
UPDATE visits SET kind = 'comanda' WHERE kind = 'alta' AND path = '/comanda';
UPDATE visits SET slug = substr(path, 1, 80) WHERE kind = 'alta';
