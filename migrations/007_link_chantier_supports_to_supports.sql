-- L'ancienne clé unique (id_chantier, support) sert aussi d'index pour la FK
-- fk_chantier_supports_chantier : on ne peut pas la supprimer avant d'avoir
-- une clé de remplacement qui commence aussi par id_chantier.

ALTER TABLE chantier_supports
  DROP COLUMN support,
  ADD COLUMN id_support INT UNSIGNED NOT NULL AFTER id_chantier,
  ADD COLUMN information TEXT NULL AFTER hauteur;

ALTER TABLE chantier_supports
  ADD CONSTRAINT fk_chantier_supports_support FOREIGN KEY (id_support)
    REFERENCES supports (id_support);

ALTER TABLE chantier_supports
  DROP KEY uq_chantier_support,
  ADD UNIQUE KEY uq_chantier_support (id_chantier, id_support);
