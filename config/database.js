const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  connectionLimit: 20,
  // Les colonnes DATE (sans heure) reviennent en chaîne "YYYY-MM-DD" brute,
  // pour éviter qu'elles soient converties en objet Date puis réinterprétées
  // dans un autre fuseau horaire (ce qui décale le jour de -1 à l'affichage).
  dateStrings: ["DATE"],
});

module.exports = pool;
