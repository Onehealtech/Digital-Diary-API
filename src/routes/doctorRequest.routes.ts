import express from "express";
import { authCheck, patientAuthCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";
import * as controller from "../controllers/doctorAssignmentRequest.controller";

const router = express.Router();

// ── Patient-facing (mobile app, patient JWT auth) ────────────────────────

// POST /api/v1/doctor-requests — patient sends request to doctor
router.post("/", patientAuthCheck, controller.createRequest);

// GET /api/v1/doctor-requests/my-requests — patient views their requests
router.get("/my-requests", patientAuthCheck, controller.getMyRequests);

// ── Doctor-facing (web dashboard, staff JWT auth) ────────────────────────

// GET /api/v1/doctor-requests — doctor lists assignment requests
router.get("/", authCheck([UserRole.DOCTOR]), controller.getRequests);

// PUT /api/v1/doctor-requests/:id/accept — doctor accepts
router.put("/:id/accept", authCheck([UserRole.DOCTOR]), controller.acceptRequest);

// PUT /api/v1/doctor-requests/:id/reject — doctor rejects
router.put("/:id/reject", authCheck([UserRole.DOCTOR]), controller.rejectRequest);

export default router;
