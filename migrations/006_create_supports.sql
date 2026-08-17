CREATE TABLE IF NOT EXISTS supports (
  id_support INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type_support VARCHAR(100) NOT NULL,
  information TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL,
  UNIQUE KEY uq_supports_type (type_support)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO supports (type_support) VALUES
  ('Terre cuite'),
  ('Béton'),
  ('Carrelage'),
  ('Ardoise'),
  ('Terre naturelle'),
  ('PVC'),
  ('Crépis'),
  ('Enduit'),
  ('Peinture');
