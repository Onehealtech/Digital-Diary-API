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
const authMiddleware_1 = require("../middleware/authMiddleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const constants_1 = require("../utils/constants");
const bubbleScanController = __importStar(require("../controllers/bubbleScan.controller"));
const router = express_1.default.Router();
// === Patient Routes (require patient authentication) ===
// Manual diary answer submission (for non-scan mode)
router.post("/manual", authMiddleware_1.patientAuthCheck, bubbleScanController.manualSubmitBubbleScan);
// Upload diary page photo for AI vision scanning (replaces Python OMR)
router.post("/upload", authMiddleware_1.patientAuthCheck, upload_middleware_1.visionScanUpload.single("image"), bubbleScanController.uploadBubbleScan);
// Get patient's bubble scan history
router.get("/history", authMiddleware_1.patientAuthCheck, bubbleScanController.getBubbleScanHistory);
// Get available diary pages (replaces old Python templates list)
router.get("/templates", authMiddleware_1.patientAuthCheck, bubbleScanController.getAvailableTemplates);
// Get single bubble scan result
router.get("/:id", authMiddleware_1.patientAuthCheck, bubbleScanController.getBubbleScanById);
// Edit a scan entry's answers (only scan-type submissions)
router.put("/:id/edit", authMiddleware_1.patientAuthCheck, bubbleScanController.editBubbleScan);
// Retry a failed scan
router.post("/:id/retry", authMiddleware_1.patientAuthCheck, bubbleScanController.retryBubbleScan);
// === Doctor/Assistant Routes ===
// Get all bubble scans for doctor's patients
router.get("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), bubbleScanController.getAllBubbleScans);
// Doctor reviews and optionally overrides bubble scan results
router.put("/:id/review", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR]), bubbleScanController.reviewBubbleScan);
exports.default = router;
