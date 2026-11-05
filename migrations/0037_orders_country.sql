-- țara (după IP) de unde s-a plasat comanda; gol la comenzile vechi
ALTER TABLE orders ADD COLUMN country TEXT NOT NULL DEFAULT '';
