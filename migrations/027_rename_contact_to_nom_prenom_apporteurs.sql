ALTER TABLE apporteurs_affaires
  CHANGE COLUMN contact nom VARCHAR(100) NOT NULL,
  ADD COLUMN prenom VARCHAR(100) NULL AFTER nom,
  ADD COLUMN commission DECIMAL(5,2) NULL AFTER numero_tva;

DROP INDEX idx_apporteurs_contact ON apporteurs_affaires;
ALTER TABLE apporteurs_affaires ADD INDEX idx_apporteurs_nom (nom);
