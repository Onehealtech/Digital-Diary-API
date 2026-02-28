import express from "express";
import { patientAuthCheck, authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";
import * as diaryPageController from "../controllers/diaryPage.controller";

const router = express.Router();

// Get all diary pages with questions (patient app uses this for manual entry)
router.get("/", patientAuthCheck, diaryPageController.getAllDiaryPages);

// Get a single diary page by page number
router.get("/:pageNumber", patientAuthCheck, diaryPageController.getDiaryPageByNumber);

// Seed diary pages (super admin only)
router.post(
    "/seed",
    authCheck([UserRole.SUPER_ADMIN]),
    diaryPageController.seedDiaryPages
);

export default router;
