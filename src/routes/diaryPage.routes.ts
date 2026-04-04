import express from "express";
import { patientAuthCheck, authCheck } from "../middleware/authMiddleware";
import { requireApprovedDiary } from "../middleware/diaryApproval.middleware";
import { UserRole } from "../utils/constants";
import * as diaryPageController from "../controllers/diaryPage.controller";

const router = express.Router();

// Get all diary pages with questions (patient app uses this for manual entry)
router.get("/", patientAuthCheck, requireApprovedDiary, diaryPageController.getAllDiaryPages);

// Get all diary pages (doctor/assistant access for viewing patient submissions)
router.get("/staff/all", authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]), diaryPageController.getAllDiaryPagesStaff);

// Get doctor-prefilled question marks for a page (patient app pre-fills checkboxes)
router.get("/:pageNumber/doctor-marks", patientAuthCheck, requireApprovedDiary, diaryPageController.getDoctorMarksForPage);

// Get a single diary page by page number
router.get("/:pageNumber", patientAuthCheck, requireApprovedDiary, diaryPageController.getDiaryPageByNumber);

// Seed diary pages (super admin only)
router.post(
    "/seed",
    authCheck([UserRole.SUPER_ADMIN]),
    diaryPageController.seedDiaryPages
);

export default router;
