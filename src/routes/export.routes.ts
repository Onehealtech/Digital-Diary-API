import { Router } from "express";
import { exportController } from "../controllers/export.controller";
import { authCheck } from "../middleware/authMiddleware";
import { requirePermission } from "../middleware/permissionMiddleware";
import { UserRole } from "../utils/constants";

const router = Router();

/**
 * Reports & Export Routes
 * Doctors and Assistants can export patient data, diary pages, test summaries
 */

// Export patient data (PDF/Excel/CSV)
router.post(
  "/patient-data",
  authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
  requirePermission('exportData'),
  exportController.exportPatientData
);

// Export diary pages (PDF/ZIP)
router.post(
  "/diary-pages",
  authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
  requirePermission('exportData'),
  exportController.exportDiaryPages
);

// Export test summary (PDF/Excel)
router.post(
  "/test-summary",
  authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
  requirePermission('exportData'),
  exportController.exportTestSummary
);

// Get all exports for logged-in user
router.get(
  "/exports",
  authCheck([UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.SUPER_ADMIN]),
  requirePermission('exportData'),
  exportController.getUserExports
);

// Get download URL for an export
router.get(
  "/exports/:id/download",
  authCheck([UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.SUPER_ADMIN]),
  requirePermission('exportData'),
  exportController.downloadExport
);

// Delete an export
router.delete(
  "/exports/:id",
  authCheck([UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.SUPER_ADMIN]),
  requirePermission('exportData'),
  exportController.deleteExport
);

// Get patient analytics
router.get(
  "/analytics/patient/:id",
  authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
  requirePermission('exportData'),
  exportController.getPatientAnalytics
);

export default router;
