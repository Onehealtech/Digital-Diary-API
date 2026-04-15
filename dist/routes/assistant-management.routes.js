"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const staff_controller_1 = require("../controllers/staff.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const constants_1 = require("../utils/constants");
const router = (0, express_1.Router)();
/**
 * Assistant Management Routes
 * Super Admin can manage all assistants
 * Doctor can manage their own assistants
 */
// Get all assistants (Super Admin sees all, Doctor sees their own)
router.get("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR]), staff_controller_1.staffController.getAllAssistants);
// Get all archived assistants
router.get("/archived", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR]), staff_controller_1.staffController.getArchivedAssistants);
// Restore an archived assistant
router.post("/:id/restore", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR]), staff_controller_1.staffController.restoreAssistant);
// Get assistant by ID
router.get("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR]), staff_controller_1.staffController.getAssistantById);
// Update assistant
router.put("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR]), staff_controller_1.staffController.updateAssistant);
// Delete assistant
router.delete("/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.DOCTOR]), staff_controller_1.staffController.deleteAssistant);
exports.default = router;
