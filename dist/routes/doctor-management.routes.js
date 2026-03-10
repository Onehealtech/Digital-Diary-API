"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const staff_controller_1 = require("../controllers/staff.controller");
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
// Get doctor by ID
router.get("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), staff_controller_1.staffController.getDoctorById);
// Update doctor
router.put("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), staff_controller_1.staffController.updateDoctor);
// Delete doctor
router.delete("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), staff_controller_1.staffController.deleteDoctor);
exports.default = router;
