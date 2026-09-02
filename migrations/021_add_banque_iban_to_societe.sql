ALTER TABLE societe
  ADD COLUMN banque VARCHAR(150) NULL AFTER conditions_vente,
  ADD COLUMN iban VARCHAR(34) NULL AFTER banque;
