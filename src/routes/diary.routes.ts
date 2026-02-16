import { Router } from "express";
import { DiaryController } from "../controllers/diary.controller";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

const router = Router();
const diaryController = new DiaryController();

/**
 * Diary Management Routes
 * Base path: /api/v1
 */

// POST /api/v1/generated-diaries/generate - Generate diaries (SUPER_ADMIN only)
router.post(
  "/generated-diaries/generate",
  authCheck([UserRole.SUPER_ADMIN]),
  diaryController.generateDiaries.bind(diaryController)
);

// GET /api/v1/generated-diaries - List generated diaries
router.get(
  "/generated-diaries",
  authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR]),
  diaryController.getAllGeneratedDiaries.bind(diaryController)
);

// GET /api/v1/generated-diaries/:id - Get diary by ID
router.get(
  "/generated-diaries/:id",
  authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR]),
  diaryController.getDiaryById.bind(diaryController)
);

// PUT /api/v1/generated-diaries/:id/assign - Assign diary to vendor
router.put(
  "/generated-diaries/:id/assign",
  authCheck([UserRole.SUPER_ADMIN]),
  diaryController.assignDiary.bind(diaryController)
);

// PUT /api/v1/generated-diaries/bulk-assign - Bulk assign diaries
router.put(
  "/generated-diaries/bulk-assign",
  authCheck([UserRole.SUPER_ADMIN]),
  diaryController.bulkAssignDiaries.bind(diaryController)
);

// PUT /api/v1/generated-diaries/:id/unassign - Unassign diary
router.put(
  "/generated-diaries/:id/unassign",
  authCheck([UserRole.SUPER_ADMIN]),
  diaryController.unassignDiary.bind(diaryController)
);

// PUT /api/v1/diaries/:id/approve - Approve diary sale
router.put(
  "/diaries/:id/approve",
  authCheck([UserRole.SUPER_ADMIN]),
  diaryController.approveDiarySale.bind(diaryController)
);

// PUT /api/v1/diaries/:id/reject - Reject diary sale
router.put(
  "/diaries/:id/reject",
  authCheck([UserRole.SUPER_ADMIN]),
  diaryController.rejectDiarySale.bind(diaryController)
);

// GET /api/v1/diary-requests - List diary requests
router.get(
  "/diary-requests",
  authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR]),
  diaryController.getAllDiaryRequests.bind(diaryController)
);

// POST /api/v1/diary-requests - Create diary request
router.post(
  "/diary-requests",
  authCheck([UserRole.VENDOR]),
  diaryController.createDiaryRequest.bind(diaryController)
);

// PUT /api/v1/diary-requests/:id/approve - Approve diary request
router.put(
  "/diary-requests/:id/approve",
  authCheck([UserRole.SUPER_ADMIN]),
  diaryController.approveDiaryRequest.bind(diaryController)
);

// PUT /api/v1/diary-requests/:id/reject - Reject diary request
router.put(
  "/diary-requests/:id/reject",
  authCheck([UserRole.SUPER_ADMIN]),
  diaryController.rejectDiaryRequest.bind(diaryController)
);

export default router;
