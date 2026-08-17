CREATE TABLE IF NOT EXISTS fournisseurs (
  id_fournisseur INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contact VARCHAR(100) NOT NULL,
  nom_societe VARCHAR(150) NULL,
  adresse VARCHAR(255) NULL,
  cp VARCHAR(10) NULL,
  ville VARCHAR(100) NULL,
  telephone VARCHAR(20) NULL,
  portable VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  numero_siret VARCHAR(20) NULL,
  numero_tva VARCHAR(20) NULL,
  information TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  INDEX idx_fournisseurs_contact (contact),
  INDEX idx_fournisseurs_email (email),
  INDEX idx_fournisseurs_siret (numero_siret)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
