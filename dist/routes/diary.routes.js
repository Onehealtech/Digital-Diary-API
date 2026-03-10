"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const diary_controller_1 = require("../controllers/diary.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const constants_1 = require("../utils/constants");
const router = (0, express_1.Router)();
const diaryController = new diary_controller_1.DiaryController();
/**
 * Diary Management Routes
 * Base path: /api/v1
 */
// POST /api/v1/generated-diaries/generate - Generate diaries (SUPER_ADMIN only)
router.post("/generated-diaries/generate", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), diaryController.generateDiaries.bind(diaryController));
// GET /api/v1/generated-diaries - List generated diaries
router.get("/generated-diaries", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR]), diaryController.getAllGeneratedDiaries.bind(diaryController));
// GET /api/v1/generated-diaries/:id - Get diary by ID
router.get("/generated-diaries/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR]), diaryController.getDiaryById.bind(diaryController));
// PUT /api/v1/generated-diaries/:id/assign - Assign diary to vendor
router.post("/generated-diaries/:id/assign", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), diaryController.assignDiary.bind(diaryController));
// PUT /api/v1/generated-diaries/bulk-assign - Bulk assign diaries
router.put("/generated-diaries/bulk-assign", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), diaryController.bulkAssignDiaries.bind(diaryController));
// PUT /api/v1/generated-diaries/:id/unassign - Unassign diary
router.put("/generated-diaries/:id/unassign", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), diaryController.unassignDiary.bind(diaryController));
// PUT /api/v1/diaries/sold - Sold Diaries (SUPER_ADMIN only)
router.get("/diaries/sold", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), diaryController.getAllSoldDiaries.bind(diaryController));
// PUT /api/v1/diaries/:id/approve - Approve diary sale
router.put("/diaries/:id/approve", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), diaryController.approveDiarySale.bind(diaryController));
// PUT /api/v1/diaries/:id/reject - Reject diary sale
router.put("/diaries/:id/reject", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), diaryController.rejectDiarySale.bind(diaryController));
// GET /api/v1/diary-requests - List diary requests
router.get("/diary-requests", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR]), diaryController.getAllDiaryRequests.bind(diaryController));
router.get("/sp/diary-requests", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), diaryController.getAllDiaryRequestsSuperAdmin.bind(diaryController));
// POST /api/v1/diary-requests - Create diary request
router.post("/diary-requests", (0, authMiddleware_1.authCheck)([constants_1.UserRole.VENDOR]), diaryController.createDiaryRequest.bind(diaryController));
// PUT /api/v1/diary-requests/:id/approve - Approve diary request
router.put("/diary-requests/:id/approve", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), diaryController.approveDiaryRequest.bind(diaryController));
// PUT /api/v1/diary-requests/:id/reject - Reject diary request
router.put("/diary-requests/:id/reject", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), diaryController.rejectDiaryRequest.bind(diaryController));
exports.default = router;
