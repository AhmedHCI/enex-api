const router = require("express").Router();
const reglementsController = require("../controllers/reglements.controller");

router.get("/", reglementsController.getAll);
router.delete("/:id", reglementsController.delete);

module.exports = router;
