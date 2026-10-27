ALTER TABLE agences_immobilieres
  ADD COLUMN google_place_id VARCHAR(150) NULL AFTER id_agence,
  ADD COLUMN latitude DECIMAL(10,7) NULL AFTER numero_siret,
  ADD COLUMN longitude DECIMAL(10,7) NULL AFTER latitude,
  ADD COLUMN site_internet VARCHAR(255) NULL AFTER longitude,
  ADD COLUMN visite TINYINT(1) NOT NULL DEFAULT 0 AFTER site_internet,
  ADD COLUMN rdv TINYINT(1) NOT NULL DEFAULT 0 AFTER visite,
  ADD COLUMN date_rdv DATE NULL AFTER rdv,
  ADD UNIQUE INDEX idx_agences_place_id (google_place_id);
