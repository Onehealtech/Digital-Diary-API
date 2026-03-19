import express from "express";
import { authCheck, patientAuthCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";
import * as controller from "../controllers/doctorAssignmentRequest.controller";
import * as suggestionController from "../controllers/patientDoctorSuggestion.controller";

const router = express.Router();

// ── Patient-facing (mobile app, patient JWT auth) ────────────────────────

// POST /api/v1/doctor-requests — patient sends request to doctor
router.post("/", patientAuthCheck, controller.createRequest);

// GET /api/v1/doctor-requests/my-requests — patient views their requests
router.get("/my-requests", patientAuthCheck, controller.getMyRequests);

// POST /api/v1/doctor-requests/suggest-doctor — patient suggests a new doctor to admin
router.post("/suggest-doctor", patientAuthCheck, suggestionController.createSuggestion);

// GET /api/v1/doctor-requests/my-suggestions — patient views their suggestions
router.get("/my-suggestions", patientAuthCheck, suggestionController.getMySuggestions);

// ── Doctor-facing (web dashboard, staff JWT auth) ────────────────────────

// GET /api/v1/doctor-requests — doctor lists assignment requests
router.get("/", authCheck([UserRole.DOCTOR]), controller.getRequests);

// PUT /api/v1/doctor-requests/:id/accept — doctor accepts
router.put("/:id/accept", authCheck([UserRole.DOCTOR]), controller.acceptRequest);

// PUT /api/v1/doctor-requests/:id/reject — doctor rejects
router.put("/:id/reject", authCheck([UserRole.DOCTOR]), controller.rejectRequest);

// ── Super Admin-facing (doctor suggestion management) ────────────────────

// GET /api/v1/doctor-requests/suggestions — list all patient doctor suggestions
router.get("/suggestions", authCheck([UserRole.SUPER_ADMIN]), suggestionController.getAllSuggestions);

// GET /api/v1/doctor-requests/suggestions/:id — view single suggestion
router.get("/suggestions/:id", authCheck([UserRole.SUPER_ADMIN]), suggestionController.getSuggestionById);

// POST /api/v1/doctor-requests/suggestions/:id/approve — approve suggestion
router.post("/suggestions/:id/approve", authCheck([UserRole.SUPER_ADMIN]), suggestionController.approveSuggestion);

// POST /api/v1/doctor-requests/suggestions/:id/reject — reject suggestion
router.post("/suggestions/:id/reject", authCheck([UserRole.SUPER_ADMIN]), suggestionController.rejectSuggestion);

export default router;
