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
const staffAuthController = __importStar(require("../controllers/staffAuth.controller"));
const patientAuthController = __importStar(require("../controllers/patientAuth.controller"));
const patientSelfSignupController = __importStar(require("../controllers/patientSelfSignup.controller"));
const setupController = __importStar(require("../controllers/setup.controller"));
const auth_controller_1 = require("../controllers/auth.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const constants_1 = require("../utils/constants");
const router = express_1.default.Router();
// ONE-TIME SETUP: Create first Super Admin (disable after use)
router.post("/auth/signup-super-admin", setupController.signupSuperAdmin);
// Staff Authentication Routes
router.post("/auth/login", staffAuthController.login);
router.post("/auth/verify-2fa", staffAuthController.verify2FA);
// Patient Authentication Routes (diary-based login)
router.post("/patient/login", patientAuthController.login);
router.post("/patient/verify-otp", patientAuthController.verifyOTP);
// Patient Self-Signup Routes (subscription model — phone-based)
router.post("/patient/self-signup/send-otp", patientSelfSignupController.sendSignupOtp);
router.post("/patient/self-signup/verify", patientSelfSignupController.verifyAndCreate);
router.post("/patient/self-signup/login", patientSelfSignupController.selfSignupLogin);
router.post("/patient/self-signup/verify-login", patientSelfSignupController.verifySelfSignupLogin);
router.get("/patient/self-signup/doctors", patientSelfSignupController.listDoctors);
// Authentication Enhancements
router.get("/auth/me", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.VENDOR]), auth_controller_1.DoctorAuthController.getCurrentUser);
router.post("/auth/logout", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.VENDOR]), auth_controller_1.DoctorAuthController.logout);
router.post("/auth/refresh", auth_controller_1.DoctorAuthController.refreshToken);
router.post("/auth/forgot-password", auth_controller_1.DoctorAuthController.forgotPassword);
router.post("/auth/reset-password", auth_controller_1.DoctorAuthController.resetPassword);
router.put("/auth/change-password", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.VENDOR]), auth_controller_1.DoctorAuthController.changePassword);
router.put("/user/profile", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.VENDOR]), auth_controller_1.DoctorAuthController.updateProfile);
exports.default = router;
