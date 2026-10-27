const router = require("express").Router();
const { facturesController } = require("../controllers/factures.controller");
const reglementsController = require("../controllers/reglements.controller");

router.get("/", facturesController.getAll);
router.get("/totals", facturesController.getTotals);
router.get("/:id", facturesController.getById);
router.post("/:id/pdf", facturesController.generatePdf);
router.patch("/:id/apporteur", facturesController.assignApporteur);
router.post("/:id/reglements", reglementsController.create);
router.delete("/:id", facturesController.delete);

module.exports = router;
