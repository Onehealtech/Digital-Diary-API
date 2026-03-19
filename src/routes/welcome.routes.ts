import express from "express";
import { getWelcomeMessage } from "../controllers/welcome.controller";

const router = express.Router();

// GET /api/welcome
router.get("/", getWelcomeMessage);

export default router;

