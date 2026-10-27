const router = require("express").Router();
const clientsRoutes = require("./clients.routes");
const fournisseursRoutes = require("./fournisseurs.routes");
const apporteursAffairesRoutes = require("./apporteurs_affaires.routes");
const agencesRoutes = require("./agences.routes");
const chantiersRoutes = require("./chantiers.routes");
const supportsRoutes = require("./supports.routes");
const prestationsRoutes = require("./prestations.routes");
const devisRoutes = require("./devis.routes");
const facturesRoutes = require("./factures.routes");
const societeRoutes = require("./societe.routes");
const reglementsRoutes = require("./reglements.routes");

// Route de test simple
router.get("/ping", (req, res) => {
  res.json({ message: "pong" });
});

router.use("/clients", clientsRoutes);
router.use("/fournisseurs", fournisseursRoutes);
router.use("/apporteurs-affaires", apporteursAffairesRoutes);
router.use("/agences", agencesRoutes);
router.use("/chantiers", chantiersRoutes);
router.use("/supports", supportsRoutes);
router.use("/prestations", prestationsRoutes);
router.use("/devis", devisRoutes);
router.use("/factures", facturesRoutes);
router.use("/societe", societeRoutes);
router.use("/reglements", reglementsRoutes);

module.exports = router;
