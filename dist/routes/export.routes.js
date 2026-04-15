"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const export_controller_1 = require("../controllers/export.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const permissionMiddleware_1 = require("../middleware/permissionMiddleware");
const constants_1 = require("../utils/constants");
const router = (0, express_1.Router)();
/**
 * Reports & Export Routes
 * Doctors and Assistants can export patient data, diary pages, test summaries
 */
// Export patient data (PDF/Excel/CSV)
router.post("/patient-data", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('exportData'), export_controller_1.exportController.exportPatientData);
// Export diary pages (PDF/ZIP)
router.post("/diary-pages", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('exportData'), export_controller_1.exportController.exportDiaryPages);
// Export test summary (PDF/Excel)
router.post("/test-summary", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('exportData'), export_controller_1.exportController.exportTestSummary);
// Get all exports for logged-in user
router.get("/exports", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.SUPER_ADMIN]), (0, permissionMiddleware_1.requirePermission)('exportData'), export_controller_1.exportController.getUserExports);
// Get download URL for an export
router.get("/exports/:id/download", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.SUPER_ADMIN]), (0, permissionMiddleware_1.requirePermission)('exportData'), export_controller_1.exportController.downloadExport);
// Delete an export
router.delete("/exports/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.SUPER_ADMIN]), (0, permissionMiddleware_1.requirePermission)('exportData'), export_controller_1.exportController.deleteExport);
// Get patient analytics
router.get("/analytics/patient/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('exportData'), export_controller_1.exportController.getPatientAnalytics);
exports.default = router;
