import express from "express";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";
import {
  getAdvancedAnalysisPatients,
  getAdvancedAnalysisCount,
} from "../controllers/advancedAnalysisController";

const router = express.Router();

router.post(
  "/patients",
  authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
  getAdvancedAnalysisPatients
);

router.post(
  "/count",
  authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
  getAdvancedAnalysisCount
);

export default router;
