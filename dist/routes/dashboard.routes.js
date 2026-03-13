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
const dashboardController = __importStar(require("../controllers/dashboard.controller"));
const reminder_controller_1 = require("../controllers/reminder.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const permissionMiddleware_1 = require("../middleware/permissionMiddleware");
const constants_1 = require("../utils/constants");
const router = express_1.default.Router();
// Doctor, Assistant, and Vendor can view patients
router.get("/patients", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT, constants_1.UserRole.VENDOR, constants_1.UserRole.SUPER_ADMIN]), (0, permissionMiddleware_1.requirePermission)('viewPatients'), dashboardController.getPatients);
// Doctor and Assistant can view their created reminders
router.get("/reminders", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), reminder_controller_1.getDashboardReminders);
// Super Admin dashboard statistics
router.get("/super-admin", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), dashboardController.getSuperAdminDashboard);
router.get("/super-admin", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), dashboardController.getSuperAdminDashboard);
router.get("/getAllSuperAdmins", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), dashboardController.getAllSuperAdmins);
// Vendor dashboard statistics
router.get("/vendor", (0, authMiddleware_1.authCheck)([constants_1.UserRole.VENDOR]), dashboardController.getVendorDashboard);
// Doctor dashboard statistics
router.get("/doctor", (0, authMiddleware_1.authCheck)([constants_1.UserRole.DOCTOR]), dashboardController.getDoctorDashboard);
// Assistant dashboard statistics
router.get("/assistant", (0, authMiddleware_1.authCheck)([constants_1.UserRole.ASSISTANT]), dashboardController.getAssistantDashboard);
exports.default = router;
