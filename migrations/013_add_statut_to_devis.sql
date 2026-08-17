ALTER TABLE devis
  ADD COLUMN statut ENUM('brouillon', 'valide', 'facture') NOT NULL DEFAULT 'brouillon' AFTER date_devis;
