ALTER TABLE devis DROP FOREIGN KEY fk_devis_client;
ALTER TABLE devis DROP COLUMN id_client;
ALTER TABLE devis ADD COLUMN id_chantier INT UNSIGNED NOT NULL AFTER id_devis;
ALTER TABLE devis ADD CONSTRAINT fk_devis_chantier FOREIGN KEY (id_chantier)
  REFERENCES chantiers (id_chantier) ON DELETE CASCADE;
ALTER TABLE devis ADD INDEX idx_devis_chantier (id_chantier);
