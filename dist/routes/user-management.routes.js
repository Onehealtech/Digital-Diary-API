"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const staff_controller_1 = require("../controllers/staff.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const constants_1 = require("../utils/constants");
const router = (0, express_1.Router)();
/**
 * User Management Routes (Super Admin only)
 * View, edit, archive/restore users with roles: SUPER_ADMIN, DOCTOR, VENDOR
 */
// Get all archived users
router.get("/archived", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), staff_controller_1.staffController.getArchivedUsers);
// Self-registered doctors awaiting approval — must be before /:id
router.get("/pending-registrations", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), staff_controller_1.staffController.getPendingRegistrations);
// Get user details by ID
router.get("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), staff_controller_1.staffController.getUserById);
// Update user details
router.put("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), staff_controller_1.staffController.updateUser);
// Toggle active/inactive status
router.put("/:id/toggle-status", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), staff_controller_1.staffController.toggleUserStatus);
// Restore an archived user
router.post("/:id/restore", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), staff_controller_1.staffController.restoreUser);
// Archive (soft-delete) a user
router.delete("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), staff_controller_1.staffController.archiveUser);
router.post("/:id/approve-registration", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), staff_controller_1.staffController.approveRegistration);
router.post("/:id/reject-registration", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), staff_controller_1.staffController.rejectRegistration);
exports.default = router;
