CREATE TABLE IF NOT EXISTS prestations (
  id_prestation INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(150) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  UNIQUE KEY uq_prestations_nom (nom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO prestations (nom) VALUES
  ('Nettoyage façade'),
  ('Nettoyage terrasse'),
  ('Nettoyage gouttières'),
  ('Nettoyage toiture');
