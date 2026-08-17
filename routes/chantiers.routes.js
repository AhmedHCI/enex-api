const router = require("express").Router();
const chantiersController = require("../controllers/chantiers.controller");

router.get("/", chantiersController.getAll);
router.get("/:id", chantiersController.getById);
router.post("/", chantiersController.create);
router.put("/:id", chantiersController.update);
router.delete("/:id", chantiersController.delete);

module.exports = router;
