ALTER TABLE devis
  ADD COLUMN id_apporteur INT UNSIGNED NULL AFTER id_chantier,
  ADD CONSTRAINT fk_devis_apporteur FOREIGN KEY (id_apporteur)
    REFERENCES apporteurs_affaires (id_apporteur) ON DELETE SET NULL,
  ADD INDEX idx_devis_apporteur (id_apporteur);

ALTER TABLE factures
  ADD COLUMN id_apporteur INT UNSIGNED NULL AFTER id_chantier,
  ADD CONSTRAINT fk_factures_apporteur FOREIGN KEY (id_apporteur)
    REFERENCES apporteurs_affaires (id_apporteur) ON DELETE SET NULL,
  ADD INDEX idx_factures_apporteur (id_apporteur);
