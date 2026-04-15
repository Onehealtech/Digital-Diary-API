import express from "express";
import { authCheck } from "../middleware/authMiddleware";
import { validate } from "../middleware/validate.middleware";
import { UserRole } from "../utils/constants";
import {
  submitDoctorRequestSchema,
  rejectRequestSchema,
  assignDoctorSchema,
  listRequestsQuerySchema,
} from "../schemas/doctorOnboard.schemas";
import * as doctorOnboardController from "../controllers/doctorOnboard.controller";

const router = express.Router();

// ── Vendor Routes ────────────────────────────────────────────────────────

// Vendor submits a doctor onboard request
router.post(
  "/doctor-requests",
  authCheck([UserRole.VENDOR]),
  validate({ body: submitDoctorRequestSchema }),
  doctorOnboardController.submitRequest
);

// Vendor views their own requests
router.get(
  "/doctor-requests/my",
  authCheck([UserRole.VENDOR]),
  validate({ query: listRequestsQuerySchema }),
  doctorOnboardController.getMyRequests
);

// Vendor gets their assigned doctors (for patient registration dropdown)
router.get(
  "/vendor-doctors/my",
  authCheck([UserRole.VENDOR]),
  doctorOnboardController.getVendorDoctors
);

// ── SuperAdmin Routes ────────────────────────────────────────────────────

// SuperAdmin views all requests
router.get(
  "/doctor-requests",
  authCheck([UserRole.SUPER_ADMIN]),
  validate({ query: listRequestsQuerySchema }),
  doctorOnboardController.getAllRequests
);

// SuperAdmin views a single request
router.get(
  "/doctor-requests/:id",
  authCheck([UserRole.SUPER_ADMIN]),
  doctorOnboardController.getRequestById
);

// SuperAdmin checks for duplicate doctors matching a request
router.get(
  "/doctor-requests/:id/check-duplicate",
  authCheck([UserRole.SUPER_ADMIN]),
  doctorOnboardController.checkDuplicateDoctor
);

// SuperAdmin approves a request
router.post(
  "/doctor-requests/:id/approve",
  authCheck([UserRole.SUPER_ADMIN]),
  doctorOnboardController.approveRequest
);

// SuperAdmin rejects a request
router.post(
  "/doctor-requests/:id/reject",
  authCheck([UserRole.SUPER_ADMIN]),
  validate({ body: rejectRequestSchema }),
  doctorOnboardController.rejectRequest
);

// SuperAdmin assigns an existing doctor to a vendor
router.post(
  "/vendor-doctors/assign",
  authCheck([UserRole.SUPER_ADMIN]),
  validate({ body: assignDoctorSchema }),
  doctorOnboardController.assignDoctorToVendor
);

// SuperAdmin removes a doctor-vendor assignment
router.delete(
  "/vendor-doctors/:vendorId/:doctorId",
  authCheck([UserRole.SUPER_ADMIN]),
  doctorOnboardController.removeDoctorFromVendor
);

// Get doctors assigned to a specific vendor (SuperAdmin or Vendor)
router.get(
  "/vendor-doctors/:vendorId",
  authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR]),
  doctorOnboardController.getVendorDoctors
);

export default router;
