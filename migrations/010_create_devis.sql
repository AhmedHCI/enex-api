CREATE TABLE IF NOT EXISTS devis (
  id_devis INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_client INT UNSIGNED NOT NULL,
  date_devis DATE NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  CONSTRAINT fk_devis_client FOREIGN KEY (id_client)
    REFERENCES clients (id_client) ON DELETE CASCADE,
  INDEX idx_devis_client (id_client)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS devis_prestations (
  id_devis_prestation INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_devis INT UNSIGNED NOT NULL,
  id_prestation INT UNSIGNED NOT NULL,
  CONSTRAINT fk_devis_prestations_devis FOREIGN KEY (id_devis)
    REFERENCES devis (id_devis) ON DELETE CASCADE,
  CONSTRAINT fk_devis_prestations_prestation FOREIGN KEY (id_prestation)
    REFERENCES prestations (id_prestation),
  UNIQUE KEY uq_devis_prestation (id_devis, id_prestation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS devis_prestation_supports (
  id_devis_prestation_support INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_devis_prestation INT UNSIGNED NOT NULL,
  id_support INT UNSIGNED NOT NULL,
  longueur DECIMAL(10, 2) NULL,
  largeur DECIMAL(10, 2) NULL,
  superficie DECIMAL(10, 2) NULL,
  hauteur DECIMAL(10, 2) NULL,
  prix_m2 DECIMAL(10, 2) NULL,
  CONSTRAINT fk_devis_prestation_supports_ligne FOREIGN KEY (id_devis_prestation)
    REFERENCES devis_prestations (id_devis_prestation) ON DELETE CASCADE,
  CONSTRAINT fk_devis_prestation_supports_support FOREIGN KEY (id_support)
    REFERENCES supports (id_support),
  UNIQUE KEY uq_devis_prestation_support (id_devis_prestation, id_support)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
