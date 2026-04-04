const express = require("express");
const { welcomeUser } = require("../controllers/welcomeController");

const router = express.Router();

// GET /api/welcome
router.get("/welcome", welcomeUser);

module.exports = router;

