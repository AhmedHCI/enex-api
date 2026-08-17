const router = require("express").Router();
const societeController = require("../controllers/societe.controller");

router.get("/", societeController.get);
router.put("/", societeController.update);

module.exports = router;
