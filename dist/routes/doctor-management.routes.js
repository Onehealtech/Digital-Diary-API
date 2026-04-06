"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const staff_controller_1 = require("../controllers/staff.controller");
const admin_controller_1 = require("../controllers/admin.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const constants_1 = require("../utils/constants");
const router = (0, express_1.Router)();
/**
 * Doctor Management Routes
 * Super Admin can manage all doctors
 */
// Get all doctors
router.get("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), staff_controller_1.staffController.getAllDoctors);
router.get("/getDoctorsByVendor", (0, authMiddleware_1.authCheck)([constants_1.UserRole.VENDOR]), staff_controller_1.staffController.getVendorDoctors);
// Retry Cashfree onboarding for a doctor (idempotent).
router.post("/:id/retry-cashfree", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), admin_controller_1.retryCashfreeOnboarding);
// Get doctor by ID
router.get("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR]), staff_controller_1.staffController.getDoctorById);
// Update doctor
router.put("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), staff_controller_1.staffController.updateDoctor);
// Delete doctor
router.delete("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), staff_controller_1.staffController.deleteDoctor);
exports.default = router;
