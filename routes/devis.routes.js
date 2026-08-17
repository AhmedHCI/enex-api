const router = require("express").Router();
const devisController = require("../controllers/devis.controller");

router.get("/", devisController.getAll);
router.get("/:id", devisController.getById);
router.post("/:id/pdf", devisController.generatePdf);
router.post("/:id/valider", devisController.validate);
router.post("/:id/signature", devisController.sign);
router.post("/:id/facture", devisController.convertToFacture);
router.post("/", devisController.create);
router.put("/:id", devisController.update);
router.delete("/:id", devisController.delete);

module.exports = router;
