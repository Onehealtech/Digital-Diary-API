import express from "express";
import { welcomeUser } from "../controllers/welcome.controller";
import { patientAuthCheck } from "../middleware/authMiddleware";



const router = express.Router();

// GET /api/welcome
router.get("/",patientAuthCheck, welcomeUser);

export default router;