"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.staffController = void 0;
const staff_service_1 = require("../service/staff.service");
const response_1 = require("../utils/response");
const activityLogger_1 = require("../utils/activityLogger");
class StaffController {
    // ==================== DOCTOR MANAGEMENT ====================
    /**
     * GET /api/v1/doctors
     * Get all doctors (Super Admin only)
     */
    async getAllDoctors(req, res) {
        try {
            const role = req.user?.role;
            if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Only Super Admins can view all doctors", 403);
            }
            const { page, limit, search } = req.query;
            const result = await staff_service_1.staffService.getAllDoctors({
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
                search: search,
            });
            return (0, response_1.sendResponse)(res, result, "Doctors fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    async getVendorDoctors(req, res) {
        try {
            const role = req.user?.role;
            const vendorId = req.user?.id;
            if (role !== "VENDOR") {
                return (0, response_1.sendError)(res, "Only Vendors can view their doctors", 403);
            }
            const { page, limit, search } = req.query;
            const result = await staff_service_1.staffService.getVendorDoctors(vendorId, {
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
                search: search,
            });
            return (0, response_1.sendResponse)(res, result, "Vendor doctors fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * GET /api/v1/doctors/:id
     * Get doctor by ID
     */
    async getDoctorById(req, res) {
        try {
            const id = req.params.id;
            const role = req.user?.role;
            if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Only Super Admins can view doctor details", 403);
            }
            const doctor = await staff_service_1.staffService.getDoctorById(id);
            return (0, response_1.sendResponse)(res, doctor, "Doctor details fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
        }
    }
    /**
     * PUT /api/v1/doctors/:id
     * Update doctor details
     */
    async updateDoctor(req, res) {
        try {
            const id = req.params.id;
            const role = req.user?.role;
            if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Only Super Admins can update doctors", 403);
            }
            const updates = req.body;
            const doctor = await staff_service_1.staffService.updateDoctor(id, updates);
            return (0, response_1.sendResponse)(res, doctor, "Doctor updated successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
        }
    }
    /**
     * DELETE /api/v1/doctors/:id
     * Delete doctor
     */
    async deleteDoctor(req, res) {
        try {
            const id = req.params.id;
            const role = req.user?.role;
            if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Only Super Admins can delete doctors", 403);
            }
            const result = await staff_service_1.staffService.deleteDoctor(id);
            return (0, response_1.sendResponse)(res, result, "Doctor deleted successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 400);
        }
    }
    // ==================== ASSISTANT MANAGEMENT ====================
    /**
     * GET /api/v1/assistants
     * Get all assistants
     * Super Admin sees all, Doctor sees their own
     */
    async getAllAssistants(req, res) {
        try {
            const userId = req.user?.id;
            const role = req.user?.role;
            if (!userId || !["SUPER_ADMIN", "DOCTOR"].includes(role || "")) {
                return (0, response_1.sendError)(res, "Only Super Admins and Doctors can view assistants", 403);
            }
            const { page, limit, search } = req.query;
            // Doctor can only see their own assistants
            const doctorId = role === "DOCTOR" ? userId : undefined;
            const result = await staff_service_1.staffService.getAllAssistants({
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
                search: search,
            }, doctorId);
            return (0, response_1.sendResponse)(res, result, "Assistants fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * GET /api/v1/assistants/:id
     * Get assistant by ID
     */
    async getAssistantById(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user?.id;
            const role = req.user?.role;
            if (!userId || !["SUPER_ADMIN", "DOCTOR"].includes(role || "")) {
                return (0, response_1.sendError)(res, "Only Super Admins and Doctors can view assistant details", 403);
            }
            const assistant = await staff_service_1.staffService.getAssistantById(id);
            // If doctor, verify this is their assistant
            if (role === "DOCTOR" && assistant.parentId !== userId) {
                return (0, response_1.sendError)(res, "You can only view your own assistants", 403);
            }
            return (0, response_1.sendResponse)(res, assistant, "Assistant details fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
        }
    }
    /**
     * PUT /api/v1/assistants/:id
     * Update assistant details
     */
    async updateAssistant(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user?.id;
            const role = req.user?.role;
            if (!userId || !["SUPER_ADMIN", "DOCTOR"].includes(role || "")) {
                return (0, response_1.sendError)(res, "Only Super Admins and Doctors can update assistants", 403);
            }
            const updates = req.body;
            // If doctor, verify this is their assistant
            if (role === "DOCTOR") {
                const assistant = await staff_service_1.staffService.getAssistantById(id);
                if (assistant.parentId !== userId) {
                    return (0, response_1.sendError)(res, "You can only update your own assistants", 403);
                }
            }
            const assistant = await staff_service_1.staffService.updateAssistant(id, updates);
            return (0, response_1.sendResponse)(res, assistant, "Assistant updated successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
        }
    }
    /**
     * DELETE /api/v1/assistants/:id
     * Delete assistant
     */
    async deleteAssistant(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user?.id;
            const role = req.user?.role;
            if (!userId || !["SUPER_ADMIN", "DOCTOR"].includes(role || "")) {
                return (0, response_1.sendError)(res, "Only Super Admins and Doctors can delete assistants", 403);
            }
            // If doctor, verify this is their assistant
            if (role === "DOCTOR") {
                const assistant = await staff_service_1.staffService.getAssistantById(id);
                if (assistant.parentId !== userId) {
                    return (0, response_1.sendError)(res, "You can only delete your own assistants", 403);
                }
            }
            const result = await staff_service_1.staffService.deleteAssistant(id, userId);
            (0, activityLogger_1.logActivity)({
                req,
                userId: userId,
                userRole: role,
                action: "ASSISTANT_ARCHIVED",
                details: { assistantId: id },
            });
            return (0, response_1.sendResponse)(res, result, "Assistant archived successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 400);
        }
    }
    /**
     * GET /api/v1/assistants/archived
     * Get all archived assistants
     */
    async getArchivedAssistants(req, res) {
        try {
            const userId = req.user?.id;
            const role = req.user?.role;
            if (!userId || !["SUPER_ADMIN", "DOCTOR"].includes(role || "")) {
                return (0, response_1.sendError)(res, "Only Super Admins and Doctors can view archived assistants", 403);
            }
            const { page, limit, search } = req.query;
            const doctorId = role === "DOCTOR" ? userId : undefined;
            const result = await staff_service_1.staffService.getArchivedAssistants({
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
                search: search,
            }, doctorId);
            return (0, response_1.sendResponse)(res, result, "Archived assistants fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * POST /api/v1/assistants/:id/restore
     * Restore an archived assistant
     */
    async restoreAssistant(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user?.id;
            const role = req.user?.role;
            if (!userId || !["SUPER_ADMIN", "DOCTOR"].includes(role || "")) {
                return (0, response_1.sendError)(res, "Only Super Admins and Doctors can restore assistants", 403);
            }
            // If doctor, verify ownership via paranoid-false lookup
            if (role === "DOCTOR") {
                const { assistants } = await staff_service_1.staffService.getArchivedAssistants({}, userId);
                const owns = assistants.some((a) => a.id === id);
                if (!owns) {
                    return (0, response_1.sendError)(res, "You can only restore your own assistants", 403);
                }
            }
            const result = await staff_service_1.staffService.restoreAssistant(id);
            (0, activityLogger_1.logActivity)({
                req,
                userId: userId,
                userRole: role,
                action: "ASSISTANT_RESTORED",
                details: { assistantId: id },
            });
            return (0, response_1.sendResponse)(res, result, "Assistant restored successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 400);
        }
    }
    // ==================== USER PROFILE VIEW & EDIT ====================
    /**
     * GET /api/v1/users/:id
     * Get user profile by ID (Super Admin only)
     */
    async getUserById(req, res) {
        try {
            const id = req.params.id;
            const role = req.user?.role;
            if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Only Super Admins can view user profiles", 403);
            }
            const user = await staff_service_1.staffService.getUserById(id);
            return (0, response_1.sendResponse)(res, user, "User details fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
        }
    }
    /**
     * PUT /api/v1/users/:id
     * Update user profile (Super Admin only)
     */
    async updateUser(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user?.id;
            const role = req.user?.role;
            if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Only Super Admins can update user profiles", 403);
            }
            const updates = req.body;
            const user = await staff_service_1.staffService.updateUser(id, updates, userId);
            (0, activityLogger_1.logActivity)({
                req,
                userId: userId,
                userRole: role,
                action: "USER_UPDATED",
                details: { targetUserId: id, updatedFields: Object.keys(updates) },
            });
            return (0, response_1.sendResponse)(res, user, "User updated successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 500);
        }
    }
    // ==================== USER STATUS TOGGLE ====================
    /**
     * PUT /api/v1/users/:id/toggle-status
     * Toggle a user's active/inactive status. Super Admin only. Cannot deactivate self.
     */
    async toggleUserStatus(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user?.id;
            const role = req.user?.role;
            if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Only Super Admins can toggle user status", 403);
            }
            const result = await staff_service_1.staffService.toggleUserStatus(id, userId);
            (0, activityLogger_1.logActivity)({
                req,
                userId: userId,
                userRole: role,
                action: result.user.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
                details: { targetUserId: id, newStatus: result.user.isActive ? "active" : "inactive" },
            });
            return (0, response_1.sendResponse)(res, result, result.message);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Failed to toggle user status";
            return (0, response_1.sendError)(res, message, message.includes("not found") ? 404 : 400);
        }
    }
    // ==================== USER ARCHIVING (SUPER_ADMIN, DOCTOR, VENDOR) ====================
    /**
     * DELETE /api/v1/users/:id
     * Archive (soft-delete) a user. Super Admin only. Cannot archive self.
     */
    async archiveUser(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user?.id;
            const role = req.user?.role;
            if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Only Super Admins can archive users", 403);
            }
            const result = await staff_service_1.staffService.archiveUser(id, userId);
            (0, activityLogger_1.logActivity)({
                req,
                userId: userId,
                userRole: role,
                action: "USER_ARCHIVED",
                details: { targetUserId: id },
            });
            return (0, response_1.sendResponse)(res, result, "User archived successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 400);
        }
    }
    /**
     * GET /api/v1/users/archived
     * Get all archived users. Super Admin only.
     */
    async getArchivedUsers(req, res) {
        try {
            const role = req.user?.role;
            if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Only Super Admins can view archived users", 403);
            }
            const { page, limit, search } = req.query;
            const result = await staff_service_1.staffService.getArchivedUsers({
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
                search: search,
            });
            return (0, response_1.sendResponse)(res, result, "Archived users fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * POST /api/v1/users/:id/restore
     * Restore an archived user. Super Admin only.
     */
    async restoreUser(req, res) {
        try {
            const id = req.params.id;
            const userId = req.user?.id;
            const role = req.user?.role;
            if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Only Super Admins can restore users", 403);
            }
            const result = await staff_service_1.staffService.restoreUser(id);
            (0, activityLogger_1.logActivity)({
                req,
                userId: userId,
                userRole: role,
                action: "USER_RESTORED",
                details: { targetUserId: id },
            });
            return (0, response_1.sendResponse)(res, result, "User restored successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message, error.message.includes("not found") ? 404 : 400);
        }
    }
}
exports.staffController = new StaffController();
