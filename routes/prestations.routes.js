const router = require("express").Router();
const prestationsController = require("../controllers/prestations.controller");

router.get("/", prestationsController.getAll);
router.get("/:id", prestationsController.getById);
router.post("/", prestationsController.create);
router.put("/:id", prestationsController.update);
router.delete("/:id", prestationsController.delete);

module.exports = router;
