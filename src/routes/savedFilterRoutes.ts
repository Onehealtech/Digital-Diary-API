import { Router } from "express";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";
import {
  createSavedFilter,
  getSavedFilters,
  getSavedFilterById,
  updateSavedFilter,
  deleteSavedFilter,
  assignSavedFilter,
  applySavedFilter,
  getAllFiltersAdmin,
} from "../controllers/savedFilterController";

const router = Router();

// ── Super Admin only ──────────────────────────────────────────────
/** GET  /api/v1/saved-filters/admin/all — list ALL filters (admin view) */
router.get(
  "/admin/all",
  authCheck([UserRole.SUPER_ADMIN]),
  getAllFiltersAdmin
);

/** POST /api/v1/saved-filters/:id/assign — assign global filter to doctors */
router.post(
  "/:id/assign",
  authCheck([UserRole.SUPER_ADMIN]),
  assignSavedFilter
);

// ── Shared ────────────────────────────────────────────────────────
/** POST /api/v1/saved-filters */
router.post(
  "/",
  authCheck([UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.SUPER_ADMIN]),
  createSavedFilter
);

/** GET  /api/v1/saved-filters */
router.get(
  "/",
  authCheck([UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.SUPER_ADMIN]),
  getSavedFilters
);

/** GET  /api/v1/saved-filters/:id */
router.get(
  "/:id",
  authCheck([UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.SUPER_ADMIN]),
  getSavedFilterById
);

/** PUT  /api/v1/saved-filters/:id */
router.put(
  "/:id",
  authCheck([UserRole.DOCTOR, UserRole.SUPER_ADMIN]),
  updateSavedFilter
);

/** DELETE /api/v1/saved-filters/:id */
router.delete(
  "/:id",
  authCheck([UserRole.DOCTOR, UserRole.SUPER_ADMIN]),
  deleteSavedFilter
);

/** POST /api/v1/saved-filters/:id/apply */
router.post(
  "/:id/apply",
  authCheck([UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.SUPER_ADMIN]),
  applySavedFilter
);

export default router;
