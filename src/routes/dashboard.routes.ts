import express from "express";
import * as dashboardController from "../controllers/dashboard.controller";
import { authCheck } from "../middleware/authMiddleware";

const router = express.Router();

// Doctor, Assistant, and Pharmacist can view patients
router.get(
    "/patients",
    authCheck(["DOCTOR", "ASSISTANT", "PHARMACIST"]),
    dashboardController.getPatients
);

export default router;
