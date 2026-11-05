-- vizitele pe pagina comenzii deschise din email (nu din coș) nu sunt comenzi noi
UPDATE visits SET kind = 'status' WHERE kind = 'multumim' AND source != 'intern' AND path NOT LIKE '%plata=ok%';
