-- vizitele de azi pe adresele vechi /product/... apar ca „Link vechi”
UPDATE visits SET source = 'link-vechi' WHERE kind = 'alta' AND (path LIKE '/product/%' OR path LIKE '/produs/%' OR path LIKE '/product-category/%');
