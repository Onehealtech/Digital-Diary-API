import express from "express";
import * as dashboardController from "../controllers/dashboard.controller";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

const router = express.Router();

// Vendor can view all patients (works on behalf of pharmacist)
router.get(
    "/patients",
    authCheck([UserRole.VENDOR]),
    dashboardController.getPatients
);

export default router;
