-- blocare scurtă: aceeași comandă nu poate fi trimisă de două ori în paralel la Helpship
CREATE TABLE IF NOT EXISTS hs_locks (order_id INTEGER PRIMARY KEY, at INTEGER NOT NULL);
