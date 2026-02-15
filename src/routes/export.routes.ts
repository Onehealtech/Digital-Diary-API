import { Router } from "express";
import { exportController } from "../controllers/export.controller";
import { authCheck } from "../middleware/authMiddleware";

const router = Router();

/**
 * Reports & Export Routes
 * Doctors and Assistants can export patient data, diary pages, test summaries
 */

// Export patient data (PDF/Excel/CSV)
router.post(
  "/patient-data",
  authCheck(["DOCTOR", "ASSISTANT"]),
  exportController.exportPatientData
);

// Export diary pages (PDF/ZIP)
router.post(
  "/diary-pages",
  authCheck(["DOCTOR", "ASSISTANT"]),
  exportController.exportDiaryPages
);

// Export test summary (PDF/Excel)
router.post(
  "/test-summary",
  authCheck(["DOCTOR", "ASSISTANT"]),
  exportController.exportTestSummary
);

// Get all exports for logged-in user
router.get(
  "/exports",
  authCheck(["DOCTOR", "ASSISTANT", "SUPER_ADMIN"]),
  exportController.getUserExports
);

// Get download URL for an export
router.get(
  "/exports/:id/download",
  authCheck(["DOCTOR", "ASSISTANT", "SUPER_ADMIN"]),
  exportController.downloadExport
);

// Delete an export
router.delete(
  "/exports/:id",
  authCheck(["DOCTOR", "ASSISTANT", "SUPER_ADMIN"]),
  exportController.deleteExport
);

// Get patient analytics
router.get(
  "/analytics/patient/:id",
  authCheck(["DOCTOR", "ASSISTANT"]),
  exportController.getPatientAnalytics
);

export default router;
