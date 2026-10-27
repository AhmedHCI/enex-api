CREATE TABLE IF NOT EXISTS reglements (
  id_reglement INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_facture INT UNSIGNED NOT NULL,
  date_reglement DATE NOT NULL,
  mode_reglement ENUM('cheque', 'especes', 'virement') NOT NULL,
  numero_cheque VARCHAR(50) NULL,
  montant DECIMAL(10, 2) NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reglements_facture FOREIGN KEY (id_facture)
    REFERENCES factures (id_facture) ON DELETE CASCADE,
  INDEX idx_reglements_facture (id_facture),
  INDEX idx_reglements_date (date_reglement)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
