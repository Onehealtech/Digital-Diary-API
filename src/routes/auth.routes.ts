import express from "express";
import * as staffAuthController from "../controllers/staffAuth.controller";
import * as patientAuthController from "../controllers/patientAuth.controller";
import * as setupController from "../controllers/setup.controller";
import { DoctorAuthController } from "../controllers/auth.controller";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

const router = express.Router();

// ONE-TIME SETUP: Create first Super Admin (disable after use)
router.post("/auth/signup-super-admin", setupController.signupSuperAdmin);

// Staff Authentication Routes
router.post("/auth/login", staffAuthController.login);
router.post("/auth/verify-2fa", staffAuthController.verify2FA);

// Patient Authentication Routes
router.post("/patient/login", patientAuthController.login);
router.post("/patient/verify-otp", patientAuthController.verifyOTP);

// Authentication Enhancements
router.get(
  "/auth/me",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.VENDOR]),
  DoctorAuthController.getCurrentUser
);

router.post(
  "/auth/logout",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.VENDOR]),
  DoctorAuthController.logout
);

router.post("/auth/refresh", DoctorAuthController.refreshToken);

router.post("/auth/forgot-password", DoctorAuthController.forgotPassword);

router.post("/auth/reset-password", DoctorAuthController.resetPassword);
router.post("/auth/change-password",authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.VENDOR]), DoctorAuthController.changePassword);

export default router;
