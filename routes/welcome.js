const express = require("express");
const { getWelcomeMessage } = require("../controllers/welcomeController");

const router = express.Router();

// GET /api/welcome
router.get("/welcome", getWelcomeMessage);

module.exports = router;

