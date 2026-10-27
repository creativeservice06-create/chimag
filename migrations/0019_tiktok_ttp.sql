-- cookie-ul _ttp al pixelului TikTok, trimis și în evenimentul de pe server (potrivire mai bună a comenzilor cu reclamele)
ALTER TABLE orders ADD COLUMN ttp TEXT DEFAULT '';
