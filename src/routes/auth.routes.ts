import express from "express";
import * as staffAuthController from "../controllers/staffAuth.controller";
import * as patientAuthController from "../controllers/patientAuth.controller";
import * as setupController from "../controllers/setup.controller";

const router = express.Router();

// ONE-TIME SETUP: Create first Super Admin (disable after use)
router.post("/auth/signup-super-admin", setupController.signupSuperAdmin);

// Staff Authentication Routes
router.post("/auth/login", staffAuthController.login);
router.post("/auth/verify-2fa", staffAuthController.verify2FA);

// Patient Authentication Routes
router.post("/patient/login", patientAuthController.login);
router.post("/patient/verify-otp", patientAuthController.verifyOTP);

export default router;
