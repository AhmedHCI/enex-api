CREATE TABLE IF NOT EXISTS societe (
  id_societe INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(150) NOT NULL,
  adresse VARCHAR(255) NULL,
  cp VARCHAR(10) NULL,
  ville VARCHAR(100) NULL,
  rcs VARCHAR(50) NULL,
  naf VARCHAR(10) NULL,
  telephone VARCHAR(20) NULL,
  portable VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  tva DECIMAL(5, 2) NULL,
  marge DECIMAL(5, 2) NULL,
  jours_travail TINYINT UNSIGNED NULL,
  activite VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO societe (
  nom, adresse, cp, ville, rcs, naf, telephone, portable, email, tva, marge, jours_travail, activite
) VALUES (
  'ENEX', '14 ter Allée du Haut', '95670', 'Marly la ville', '829870641', '4332C',
  '06 99 91 95 95', '0766808676', 'talbichakibvilliers@gmail.com', 0, 90, 6,
  'Nettoyage de surfaces extérieures'
);
