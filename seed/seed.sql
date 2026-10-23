-- Date inițiale: setări implicite + 4 produse DEMO (le ștergi/înlocuiești din /admin/produse).
-- Rulează o singură dată: npm run db:seed

INSERT OR IGNORE INTO settings(key, value) VALUES
 ('store_name', 'Chimag'),
 ('tagline', 'Lucruri bune pentru acasă, livrate rapid'),
 ('phone', '0740 231 358'),
 ('email', 'contact@chimag.ro'),
 ('hours', 'Luni–Vineri, 9:00–18:00'),
 ('company_name', 'HARD SERVICE SRL'),
 ('company_cui', '5451133'),
 ('company_reg', ''),
 ('company_address', ''),
 ('shipping_cost', '1999'),
 ('free_shipping_threshold', '14900'),
 ('cod_fee', '0'),
 ('delivery_text', 'Livrare în 24–48h prin curier'),
 ('return_days', '14'),
 ('announcement', 'Transport GRATUIT la comenzile peste 149 lei · Plata la livrare'),
 ('bump_product_id', ''),
 ('bump_discount_pct', '20'),
 ('fb_pixel_id', ''),
 ('tiktok_pixel_id', ''),
 ('shipping_provider', 'test'),
 ('auto_awb_on_confirm', '0'),
 ('card_enabled', '0'),
 ('sender_name', 'Chimag'),
 ('sender_phone', '0740 231 358'),
 ('sender_county', 'București'),
 ('sender_city', 'București'),
 ('sender_address', ''),
 ('parcel_contents', 'Produse diverse');

INSERT OR IGNORE INTO products
 (slug, title, subtitle, description, price, compare_at_price, cost_price, sku, stock, weight_g, images, benefits, faq, bundles, badge, category, active, featured, sort)
VALUES
 ('lampa-birou-incarcare-wireless',
  'Lampă de birou cu încărcare wireless',
  'Lumină caldă sau rece, plus telefonul încărcat fără fire',
  'PRODUS DEMO – înlocuiește textul din panoul de administrare.

O lampă LED cu trei tonuri de lumină și cinci niveluri de intensitate, cu bază care încarcă wireless telefonul în timp ce lucrezi.

Brațul se pliază complet, așa că lampa încape și pe cele mai mici birouri.',
  14999, 24999, 6000, 'CHI-LMP-01', 120, 900,
  '["/img/demo-1.svg","/img/demo-1b.svg"]',
  '["3 tonuri de lumină, 5 niveluri de intensitate","Încărcare wireless 15W pentru telefon","Braț pliabil, ocupă puțin loc","Garanție 2 ani"]',
  '[{"q":"Merge cu orice telefon?","a":"Cu orice telefon care are încărcare wireless (Qi): iPhone 8 sau mai nou și majoritatea modelelor Samsung, Xiaomi, Huawei."},{"q":"Cât durează livrarea?","a":"24–48 de ore lucrătoare de la confirmarea comenzii."},{"q":"Pot returna produsul?","a":"Da, în 14 zile de la primire, fără să ne spui motivul."}]',
  '[{"qty":1,"pct":0,"label":""},{"qty":2,"pct":10,"label":"Cel mai ales"},{"qty":3,"pct":15,"label":"Cea mai bună ofertă"}]',
  'Best seller', 'Casă', 1, 1, 1),

 ('set-organizatoare-sertar',
  'Set 8 organizatoare pentru sertar',
  'Ordine în bucătărie, baie și birou în 5 minute',
  'PRODUS DEMO – înlocuiește textul din panoul de administrare.

Opt cutii în patru mărimi care se combină cum vrei tu, cu bază anti-alunecare.

Plastic rigid, ușor de spălat, fără miros.',
  7999, 11999, 2500, 'CHI-ORG-08', 300, 700,
  '["/img/demo-2.svg"]',
  '["8 piese în 4 mărimi","Bază anti-alunecare","Se spală ușor","Se potrivesc în sertare de la 40 cm"]',
  '[{"q":"Ce dimensiuni au?","a":"Cea mai mare are 23 × 15 cm, cea mai mică 8 × 8 cm, toate cu înălțimea de 5 cm."}]',
  '[{"qty":1,"pct":0,"label":""},{"qty":2,"pct":15,"label":"Cel mai ales"}]',
  '', 'Casă', 1, 1, 2),

 ('termos-inox-750',
  'Termos din inox 750 ml',
  'Ține cafeaua caldă 12 ore și apa rece 24 de ore',
  'PRODUS DEMO – înlocuiește textul din panoul de administrare.

Pereți dubli din oțel inoxidabil, capac etanș și mâner de transport.',
  5999, 8999, 1800, 'CHI-TRM-750', 200, 450,
  '["/img/demo-3.svg"]',
  '["Cald 12h, rece 24h","Oțel inoxidabil 304","Capac etanș, nu curge în geantă"]',
  '[]',
  '[{"qty":1,"pct":0,"label":""},{"qty":2,"pct":10,"label":"Pentru doi"}]',
  'Nou', 'Bucătărie', 1, 1, 3),

 ('perna-cervicala-memory',
  'Pernă cervicală din spumă cu memorie',
  'Gâtul sprijinit corect, dimineți fără rigiditate',
  'PRODUS DEMO – înlocuiește textul din panoul de administrare.

Spumă cu memorie care se adaptează formei capului, cu husă detașabilă care se spală la mașină.',
  11999, 17999, 4500, 'CHI-PRN-01', 80, 1200,
  '["/img/demo-4.svg"]',
  '["Spumă cu memorie de densitate medie","Husă detașabilă, lavabilă la 40°","Formă ergonomică pentru spate și lateral"]',
  '[]',
  '[{"qty":1,"pct":0,"label":""},{"qty":2,"pct":12,"label":"Cel mai ales"}]',
  '', 'Dormitor', 1, 1, 4);
