CREATE TABLE IF NOT EXISTS agences_recherches_log (
  id_log INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date_recherche DATE NOT NULL,
  nombre INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE INDEX idx_agences_recherches_date (date_recherche)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
