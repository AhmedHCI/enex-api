const router = require("express").Router();
const supportsController = require("../controllers/supports.controller");

router.get("/", supportsController.getAll);
router.get("/:id", supportsController.getById);
router.post("/", supportsController.create);
router.put("/:id", supportsController.update);
router.delete("/:id", supportsController.delete);

module.exports = router;
