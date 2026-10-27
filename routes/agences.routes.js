const router = require("express").Router();
const agencesController = require("../controllers/agences.controller");

router.get("/", agencesController.getAll);
router.get("/search/quota", agencesController.getSearchQuota);
router.get("/search", agencesController.search);
router.get("/:id", agencesController.getById);
router.post("/", agencesController.create);
router.put("/:id", agencesController.update);
router.delete("/:id", agencesController.delete);

module.exports = router;
