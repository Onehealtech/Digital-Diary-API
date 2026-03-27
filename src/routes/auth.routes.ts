import express from "express";
import * as staffAuthController from "../controllers/staffAuth.controller";
import * as patientAuthController from "../controllers/patientAuth.controller";
import * as patientSelfSignupController from "../controllers/patientSelfSignup.controller";
import * as setupController from "../controllers/setup.controller";
import { DoctorAuthController } from "../controllers/auth.controller";
import { authCheck, patientAuthCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";
import { translateResponse } from "../middleware/translateResponse.middleware";

const router = express.Router();

// ONE-TIME SETUP: Create first Super Admin (disable after use)
router.post("/auth/signup-super-admin", setupController.signupSuperAdmin);

// Staff Authentication Routes
router.post("/auth/login", staffAuthController.login);
router.post("/auth/verify-2fa", staffAuthController.verify2FA);

// Patient Authentication Routes (diary-based login)
router.post("/patient/login", patientAuthController.login);
router.post("/patient/verify-otp", patientAuthController.verifyOTP);

// Patient Self-Signup Routes (subscription model — phone-based)
// Unified: send-otp handles both new and existing users; verify handles login + signup
router.post("/patient/self-signup/send-otp", patientSelfSignupController.sendSignupOtp);
router.post("/patient/self-signup/verify", patientSelfSignupController.verifySignupOtp);
router.get("/patient/self-signup/doctors", patientAuthCheck,translateResponse(), patientSelfSignupController.listDoctors);

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

router.put(
  "/auth/change-password",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.VENDOR]),
  DoctorAuthController.changePassword
);

router.put(
  "/user/profile",
  authCheck([UserRole.SUPER_ADMIN, UserRole.DOCTOR, UserRole.ASSISTANT, UserRole.VENDOR]),
  DoctorAuthController.updateProfile
);

export default router;
