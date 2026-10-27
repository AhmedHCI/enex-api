CREATE TABLE IF NOT EXISTS agences_immobilieres (
  id_agence INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(150) NOT NULL,
  contact VARCHAR(100) NULL,
  adresse VARCHAR(255) NULL,
  cp VARCHAR(10) NULL,
  ville VARCHAR(100) NULL,
  telephone VARCHAR(20) NULL,
  portable VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  numero_siret VARCHAR(20) NULL,
  information TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  INDEX idx_agences_nom (nom),
  INDEX idx_agences_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
