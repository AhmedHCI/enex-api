ALTER TABLE factures
  ADD COLUMN taux_tva DECIMAL(5, 2) NOT NULL DEFAULT 0 AFTER date_facture;
