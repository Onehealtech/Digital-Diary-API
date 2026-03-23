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
const permissionMiddleware_1 = require("../middleware/permissionMiddleware");
const constants_1 = require("../utils/constants");
const controller = __importStar(require("../controllers/doctorAssignmentRequest.controller"));
const suggestionController = __importStar(require("../controllers/patientDoctorSuggestion.controller"));
const router = express_1.default.Router();
// ── Patient-facing (mobile app, patient JWT auth) ────────────────────────
// POST /api/v1/doctor-requests — patient sends request to doctor
router.post("/", authMiddleware_1.patientAuthCheck, controller.createRequest);
// GET /api/v1/doctor-requests/my-requests — patient views their requests
router.get("/my-requests", authMiddleware_1.patientAuthCheck, controller.getMyRequests);
// PUT /api/v1/doctor-requests/:id/cancel — patient cancels their pending request
router.put("/:id/cancel", authMiddleware_1.patientAuthCheck, controller.cancelRequest);
// POST /api/v1/doctor-requests/suggest-doctor — patient suggests a new doctor to admin
router.post("/suggest-doctor", authMiddleware_1.patientAuthCheck, suggestionController.createSuggestion);
// GET /api/v1/doctor-requests/my-suggestions — patient views their suggestions
router.get("/my-suggestions", authMiddleware_1.patientAuthCheck, suggestionController.getMySuggestions);
// ── Doctor/Assistant-facing (web dashboard, staff JWT auth) ──────────────
// GET /api/v1/doctor-requests — doctor/assistant lists assignment requests
router.get("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('manageOnboardingRequests'), controller.getRequests);
// PUT /api/v1/doctor-requests/:id/accept — doctor/assistant accepts
router.put("/:id/accept", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('manageOnboardingRequests'), controller.acceptRequest);
// PUT /api/v1/doctor-requests/:id/reject — doctor/assistant rejects
router.put("/:id/reject", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), (0, permissionMiddleware_1.requirePermission)('manageOnboardingRequests'), controller.rejectRequest);
// ── Super Admin-facing (doctor suggestion management) ────────────────────
// GET /api/v1/doctor-requests/suggestions — list all patient doctor suggestions
router.get("/suggestions", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), suggestionController.getAllSuggestions);
// GET /api/v1/doctor-requests/suggestions/:id — view single suggestion
router.get("/suggestions/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), suggestionController.getSuggestionById);
// POST /api/v1/doctor-requests/suggestions/:id/approve — approve suggestion
router.post("/suggestions/:id/approve", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), suggestionController.approveSuggestion);
// POST /api/v1/doctor-requests/suggestions/:id/reject — reject suggestion
router.post("/suggestions/:id/reject", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), suggestionController.rejectSuggestion);
exports.default = router;
