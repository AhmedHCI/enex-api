const router = require("express").Router();
const clientsController = require("../controllers/clients.controller");

router.get("/", clientsController.getAll);
router.get("/:id", clientsController.getById);
router.post("/", clientsController.create);
router.put("/:id", clientsController.update);
router.delete("/:id", clientsController.delete);

module.exports = router;
