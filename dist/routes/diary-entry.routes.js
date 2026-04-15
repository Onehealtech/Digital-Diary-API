"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const scan_controller_1 = require("../controllers/scan.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const permissionMiddleware_1 = require("../middleware/permissionMiddleware");
const constants_1 = require("../utils/constants");
const router = (0, express_1.Router)();
/**
 * Diary Entry Routes (Doctor/Assistant access)
 * These routes allow doctors and assistants to view and review patient diary entries
 */
// Get diary entry statistics
router.get("/stats", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR]), scan_controller_1.getDiaryEntryStats);
// Get pending reviews (must be before /:id to avoid route conflict)
router.get("/review/pending", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR]), scan_controller_1.getEntriesNeedingReview);
// Get all diary entries (with filters)
router.get("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('viewPatients'), scan_controller_1.getAllDiaryEntries);
// Get diary entry by ID
router.get("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('viewPatients'), scan_controller_1.getDiaryEntryById);
// Mark diary entry as reviewed
router.put("/:id/review", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('markReviewed'), scan_controller_1.reviewDiaryEntry);
// Flag/unflag diary entry
router.put("/:id/flag", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR]), scan_controller_1.toggleFlag);
exports.default = router;
