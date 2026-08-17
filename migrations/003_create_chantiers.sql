CREATE TABLE IF NOT EXISTS chantiers (
  id_chantier INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_client INT UNSIGNED NOT NULL,
  adresse VARCHAR(255) NULL,
  cp VARCHAR(10) NULL,
  ville VARCHAR(100) NULL,
  type_habitation ENUM('appartement', 'pavillon', 'societe') NOT NULL,
  surface_chantier DECIMAL(10, 2) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  CONSTRAINT fk_chantiers_client FOREIGN KEY (id_client)
    REFERENCES clients (id_client) ON DELETE CASCADE,
  INDEX idx_chantiers_client (id_client),
  INDEX idx_chantiers_ville (ville)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chantier_supports (
  id_chantier_support INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_chantier INT UNSIGNED NOT NULL,
  support ENUM(
    'terre_cuite', 'beton', 'carrelage', 'ardoise', 'terre_naturelle',
    'pvc', 'crepis', 'enduit', 'peinture'
  ) NOT NULL,
  superficie DECIMAL(10, 2) NOT NULL,
  hauteur DECIMAL(10, 2) NOT NULL,
  CONSTRAINT fk_chantier_supports_chantier FOREIGN KEY (id_chantier)
    REFERENCES chantiers (id_chantier) ON DELETE CASCADE,
  UNIQUE KEY uq_chantier_support (id_chantier, support)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
