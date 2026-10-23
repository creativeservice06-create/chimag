UPDATE settings SET value = 'HARD SERVICE SRL' WHERE key = 'company_name';
UPDATE settings SET value = '5451133' WHERE key = 'company_cui';
UPDATE settings SET value = '0740 231 358' WHERE key = 'phone';
UPDATE settings SET value = '0740 231 358' WHERE key = 'sender_phone';
UPDATE settings SET value = 'Chimag' WHERE key = 'sender_name';
UPDATE settings SET value = '' WHERE key = 'company_reg' AND value LIKE 'J40/xxxx%';
UPDATE settings SET value = '' WHERE key = 'company_address' AND value LIKE 'Strada, nr.%';
