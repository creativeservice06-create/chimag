-- Pagina lămpii Capybara: poza nouă (copil care doarme) la prima secțiune, „Somn liniștit, fără teamă de întuneric”
UPDATE products SET sections = json_set(sections, '$[0].image', '/img/lampa-capybara-somn.jpg')
WHERE slug = 'lampa-de-veghe-capybara' AND json_valid(sections) AND json_array_length(sections) > 0;
