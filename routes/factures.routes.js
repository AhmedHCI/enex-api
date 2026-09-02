const router = require("express").Router();
const { facturesController } = require("../controllers/factures.controller");

router.get("/", facturesController.getAll);
router.get("/totals", facturesController.getTotals);
router.get("/:id", facturesController.getById);
router.post("/:id/pdf", facturesController.generatePdf);
router.delete("/:id", facturesController.delete);

module.exports = router;
