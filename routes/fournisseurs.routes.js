const router = require("express").Router();
const fournisseursController = require("../controllers/fournisseurs.controller");

router.get("/", fournisseursController.getAll);
router.get("/:id", fournisseursController.getById);
router.post("/", fournisseursController.create);
router.put("/:id", fournisseursController.update);
router.delete("/:id", fournisseursController.delete);

module.exports = router;
