const router = require("express").Router();
const apporteursController = require("../controllers/apporteurs_affaires.controller");

router.get("/", apporteursController.getAll);
router.get("/:id", apporteursController.getById);
router.post("/", apporteursController.create);
router.put("/:id", apporteursController.update);
router.delete("/:id", apporteursController.delete);

module.exports = router;
