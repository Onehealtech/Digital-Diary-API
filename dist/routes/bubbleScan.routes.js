"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const diaryApproval_middleware_1 = require("../middleware/diaryApproval.middleware");
const permissionMiddleware_1 = require("../middleware/permissionMiddleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const constants_1 = require("../utils/constants");
const bubbleScanController = __importStar(require("../controllers/bubbleScan.controller"));
/**
 * Wraps a multer middleware and converts upload errors into 400 responses.
 * Without this wrapper, multer errors (e.g. "Unexpected end of form" caused by a
 * missing boundary in the client's Content-Type header) propagate to the global
 * 500 error handler instead of returning a useful client error.
 */
function withMulterErrors(multerMiddleware) {
    return (req, res, next) => {
        multerMiddleware(req, res, (err) => {
            if (!err)
                return next();
            // Missing boundary / truncated body — client sent Content-Type without boundary,
            // or manually set Content-Type: multipart/form-data (stripping the boundary).
            if (err.message === "Unexpected end of form") {
                res.status(400).json({
                    success: false,
                    message: "Invalid file upload: multipart form is malformed. " +
                        "Do NOT manually set Content-Type — let your HTTP library set it automatically so the boundary is included.",
                });
                return;
            }
            if (err instanceof multer_1.default.MulterError) {
                res.status(400).json({ success: false, message: err.message });
                return;
            }
            next(err);
        });
    };
}
const router = express_1.default.Router();
// === Patient Routes (require patient authentication) ===
// Manual diary answer submission (for non-scan mode)
// Accepts multipart/form-data so report files can be included in the same request.
// Fields: pageNumber (text), answers (JSON text), questionId[] (text), reports[] (files)
router.post("/manual", authMiddleware_1.patientAuthCheck, diaryApproval_middleware_1.requireApprovedDiary, upload_middleware_1.reportUpload.array("reports", 10), bubbleScanController.manualSubmitBubbleScan);
// Upload diary page photo for AI vision scanning (replaces Python OMR)
router.post("/upload", authMiddleware_1.patientAuthCheck, diaryApproval_middleware_1.requireApprovedDiary, withMulterErrors(upload_middleware_1.visionScanUpload.single("image")), bubbleScanController.uploadBubbleScan);
// Get patient's bubble scan history
router.get("/history", authMiddleware_1.patientAuthCheck, diaryApproval_middleware_1.requireApprovedDiary, bubbleScanController.getBubbleScanHistory);
// Get available diary pages (replaces old Python templates list)
router.get("/templates", authMiddleware_1.patientAuthCheck, diaryApproval_middleware_1.requireApprovedDiary, bubbleScanController.getAvailableTemplates);
// Get single bubble scan result
router.get("/:id", authMiddleware_1.patientAuthCheck, diaryApproval_middleware_1.requireApprovedDiary, bubbleScanController.getBubbleScanById);
// Edit a scan entry's answers (only scan-type submissions)
router.put("/:id/edit", authMiddleware_1.patientAuthCheck, diaryApproval_middleware_1.requireApprovedDiary, bubbleScanController.editBubbleScan);
// Retry a failed scan
router.post("/:id/retry", authMiddleware_1.patientAuthCheck, diaryApproval_middleware_1.requireApprovedDiary, bubbleScanController.retryBubbleScan);
// Attach report files (PDF / images) to an existing scan or manual entry
router.post("/:id/reports", authMiddleware_1.patientAuthCheck, diaryApproval_middleware_1.requireApprovedDiary, upload_middleware_1.reportUpload.array("reports", 5), bubbleScanController.attachReportFiles);
// Remove a previously attached report file
router.delete("/:id/reports", authMiddleware_1.patientAuthCheck, diaryApproval_middleware_1.requireApprovedDiary, bubbleScanController.removeReportFile);
// Attach report files to a specific question (PDF, DOC, DOCX, images — max 5 files, 25 MB each)
// multipart fields: questionId (text) + reports (files)
router.post("/:id/question-reports", authMiddleware_1.patientAuthCheck, diaryApproval_middleware_1.requireApprovedDiary, upload_middleware_1.reportUpload.array("reports", 5), bubbleScanController.attachQuestionReportFiles);
// Remove a specific report from a question
// Body: { questionId, reportUrl }
router.delete("/:id/question-reports", authMiddleware_1.patientAuthCheck, diaryApproval_middleware_1.requireApprovedDiary, bubbleScanController.removeQuestionReportFile);
// === Doctor/Assistant Routes ===
// Get all bubble scans for doctor's patients
router.get("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), bubbleScanController.getAllBubbleScans);
// Doctor/Assistant reviews and optionally overrides bubble scan results
router.put("/:id/review", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('markReviewed'), bubbleScanController.reviewBubbleScan);
// Doctor dashboard: filter patients by diary page submission status
router.get("/doctor/diary-filter", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), bubbleScanController.getDiaryFilteredPatients);
// Doctor manually fills / pre-fills an investigation report for a patient
// Assistants need the 'fillReport' permission granted by the doctor
router.post("/doctor/fill-report", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('fillReport'), bubbleScanController.doctorFillReport);
exports.default = router;
