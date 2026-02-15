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

const router = Router();

/**
 * Diary Entry Routes (Doctor/Assistant access)
 * These routes allow doctors and assistants to view and review patient diary entries
 */

// Get diary entry statistics
router.get(
    "/stats",
    authCheck(["DOCTOR"]),
    getDiaryEntryStats
);

// Get pending reviews (must be before /:id to avoid route conflict)
router.get(
    "/review/pending",
    authCheck(["DOCTOR"]),
    getEntriesNeedingReview
);

// Get all diary entries (with filters)
router.get(
    "/",
    authCheck(["DOCTOR", "ASSISTANT"]),
    getAllDiaryEntries
);

// Get diary entry by ID
router.get(
    "/:id",
    authCheck(["DOCTOR", "ASSISTANT"]),
    getDiaryEntryById
);

// Mark diary entry as reviewed
router.put(
    "/:id/review",
    authCheck(["DOCTOR"]),
    reviewDiaryEntry
);

// Flag/unflag diary entry
router.put(
    "/:id/flag",
    authCheck(["DOCTOR"]),
    toggleFlag
);

export default router;
