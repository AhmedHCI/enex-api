ALTER TABLE chantier_supports
  ADD COLUMN longueur DECIMAL(10, 2) NOT NULL AFTER support,
  ADD COLUMN largeur DECIMAL(10, 2) NOT NULL AFTER longueur;
