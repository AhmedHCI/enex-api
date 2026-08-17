CREATE TABLE IF NOT EXISTS factures (
  id_facture INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_devis INT UNSIGNED NULL,
  id_chantier INT UNSIGNED NOT NULL,
  date_facture DATE NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  CONSTRAINT fk_factures_devis FOREIGN KEY (id_devis)
    REFERENCES devis (id_devis) ON DELETE SET NULL,
  CONSTRAINT fk_factures_chantier FOREIGN KEY (id_chantier)
    REFERENCES chantiers (id_chantier) ON DELETE CASCADE,
  INDEX idx_factures_chantier (id_chantier),
  INDEX idx_factures_devis (id_devis)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS facture_prestations (
  id_facture_prestation INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_facture INT UNSIGNED NOT NULL,
  id_prestation INT UNSIGNED NOT NULL,
  CONSTRAINT fk_facture_prestations_facture FOREIGN KEY (id_facture)
    REFERENCES factures (id_facture) ON DELETE CASCADE,
  CONSTRAINT fk_facture_prestations_prestation FOREIGN KEY (id_prestation)
    REFERENCES prestations (id_prestation),
  UNIQUE KEY uq_facture_prestation (id_facture, id_prestation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS facture_prestation_supports (
  id_facture_prestation_support INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_facture_prestation INT UNSIGNED NOT NULL,
  id_support INT UNSIGNED NOT NULL,
  longueur DECIMAL(10, 2) NULL,
  largeur DECIMAL(10, 2) NULL,
  superficie DECIMAL(10, 2) NULL,
  hauteur DECIMAL(10, 2) NULL,
  prix_m2 DECIMAL(10, 2) NULL,
  CONSTRAINT fk_facture_prestation_supports_ligne FOREIGN KEY (id_facture_prestation)
    REFERENCES facture_prestations (id_facture_prestation) ON DELETE CASCADE,
  CONSTRAINT fk_facture_prestation_supports_support FOREIGN KEY (id_support)
    REFERENCES supports (id_support),
  UNIQUE KEY uq_facture_prestation_support (id_facture_prestation, id_support)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
