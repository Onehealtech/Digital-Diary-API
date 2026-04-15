const express = require("express");

const router = express.Router();

// GET /api/welcome
router.get("/welcome", welcomeUser);

module.exports = router;

