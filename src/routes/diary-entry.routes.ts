import { Router } from "express";
import {
    getAllDiaryEntries,
    getDiaryEntryById,
    reviewDiaryEntry,
    toggleFlag,
    getEntriesNeedingReview,
    getDiaryEntryStats,
} from "../controllers/scan.controller";
import { authCheck } from "../middleware/authMiddleware";
import { requirePermission } from "../middleware/permissionMiddleware";
import { UserRole } from "../utils/constants";

const router = Router();

/**
 * Diary Entry Routes (Doctor/Assistant access)
 * These routes allow doctors and assistants to view and review patient diary entries
 */

// Get diary entry statistics
router.get(
    "/stats",
    authCheck([UserRole.DOCTOR]),
    getDiaryEntryStats
);

// Get pending reviews (must be before /:id to avoid route conflict)
router.get(
    "/review/pending",
    authCheck([UserRole.DOCTOR]),
    getEntriesNeedingReview
);

// Get all diary entries (with filters)
router.get(
    "/",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    requirePermission('viewPatients'),
    getAllDiaryEntries
);

// Get diary entry by ID
router.get(
    "/:id",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    requirePermission('viewPatients'),
    getDiaryEntryById
);

// Mark diary entry as reviewed
router.put(
    "/:id/review",
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    requirePermission('markReviewed'),
    reviewDiaryEntry
);

// Flag/unflag diary entry
router.put(
    "/:id/flag",
    authCheck([UserRole.DOCTOR]),
    toggleFlag
);

export default router;
