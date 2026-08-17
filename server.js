require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { errorHandler } = require("./middleware/errorHandler");
const routes = require("./routes");

const app = express();

const documentsDir = path.join(__dirname, "documents");
fs.mkdirSync(documentsDir, { recursive: true });

app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ping de disponibilité (sans le préfixe /api, pratique pour un check rapide/monitoring)
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// PDF générés (devis, ...), servis statiquement par leur URL
app.use("/documents", express.static(documentsDir));

app.use("/api", routes);

// Route inconnue
app.use((req, res) => {
  res.status(404).json({ status: "fail", message: "Route not found" });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`enex-api en écoute sur le port ${PORT}`);
});

// Laisse le process planter proprement en cas d'erreur non gérée :
// PM2 (voir ecosystem.config.js) redémarre automatiquement le service.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
  server.close(() => process.exit(1));
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  server.close(() => process.exit(1));
});

module.exports = server;
