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
const authMiddleware_1 = require("../../middleware/authMiddleware");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const validate_middleware_1 = require("../../middleware/validate.middleware");
const constants_1 = require("../../utils/constants");
const ctrl = __importStar(require("./visionScan.controller"));
const visionScan_schemas_1 = require("./visionScan.schemas");
const router = express_1.default.Router();
// === Patient Routes ===
router.post("/manual", authMiddleware_1.patientAuthCheck, (0, validate_middleware_1.validate)({ body: visionScan_schemas_1.manualSubmitSchema }), ctrl.manualSubmitVisionScan);
router.post("/upload", authMiddleware_1.patientAuthCheck, upload_middleware_1.visionScanUpload.single("image"), (0, validate_middleware_1.validate)({ body: visionScan_schemas_1.uploadScanSchema }), ctrl.uploadVisionScan);
router.get("/history", authMiddleware_1.patientAuthCheck, (0, validate_middleware_1.validate)({ query: visionScan_schemas_1.paginationQuerySchema }), ctrl.getVisionScanHistory);
router.get("/:id", authMiddleware_1.patientAuthCheck, (0, validate_middleware_1.validate)({ params: visionScan_schemas_1.scanIdParamSchema }), ctrl.getVisionScanById);
router.post("/:id/retry", authMiddleware_1.patientAuthCheck, (0, validate_middleware_1.validate)({ params: visionScan_schemas_1.scanIdParamSchema }), ctrl.retryVisionScan);
// === Doctor/Assistant Routes ===
router.get("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, validate_middleware_1.validate)({ query: visionScan_schemas_1.allScansQuerySchema }), ctrl.getAllVisionScans);
router.put("/:id/review", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR]), (0, validate_middleware_1.validate)({ params: visionScan_schemas_1.scanIdParamSchema, body: visionScan_schemas_1.reviewScanSchema }), ctrl.reviewVisionScan);
exports.default = router;
