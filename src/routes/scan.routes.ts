import express from "express";
import * as scanController from "../controllers/scan.controller";
import { patientAuthCheck } from "../middleware/authMiddleware";

const router = express.Router();

// Patient routes (require patient authentication)
router.post("/submit", patientAuthCheck, scanController.submitScan);
router.get("/history", patientAuthCheck, scanController.getScanHistory);

export default router;
