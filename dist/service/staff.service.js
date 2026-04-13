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
Object.defineProperty(exports, "__esModule", { value: true });
exports.staffService = void 0;
const Appuser_1 = require("../models/Appuser");
const Patient_1 = require("../models/Patient");
const Task_1 = require("../models/Task");
const AuditLog_1 = require("../models/AuditLog");
const sequelize_1 = require("sequelize");
class StaffService {
    /**
     * Get all doctors
     */
    async getAllDoctors(filters = {}) {
        const { page = 1, limit = 20, search } = filters;
        const offset = (page - 1) * limit;
        const whereClause = {
            role: "DOCTOR",
        };
        if (search) {
            whereClause[sequelize_1.Op.or] = [
                { fullName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { email: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { phone: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        const { rows: doctors, count: total } = await Appuser_1.AppUser.findAndCountAll({
            where: whereClause,
            attributes: [
                "id",
                "fullName",
                "email",
                "phone",
                "specialization",
                "hospital",
                "license",
                "isActive",
                "createdAt",
                "updatedAt",
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });
        // Get patient count for each doctor
        const doctorsWithStats = await Promise.all(doctors.map(async (doctor) => {
            const patientCount = await Patient_1.Patient.count({
                where: { doctorId: doctor.id },
            });
            const assistantCount = await Appuser_1.AppUser.count({
                where: {
                    role: "ASSISTANT",
                    parentId: doctor.id,
                },
            });
            return {
                ...doctor.toJSON(),
                stats: {
                    totalPatients: patientCount,
                    totalAssistants: assistantCount,
                },
            };
        }));
        return {
            doctors: doctorsWithStats,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    async getVendorDoctors(vendorId, filters = {}) {
        if (!vendorId) {
            throw new Error("Vendor id is required");
        }
        // Uses VendorDoctor junction table via doctorOnboard service
        const { doctorOnboardService } = await Promise.resolve().then(() => __importStar(require("./doctorOnboard.service")));
        const doctors = await doctorOnboardService.getVendorDoctors(vendorId);
        return {
            doctors,
            pagination: {
                total: doctors.length,
                page: 1,
                limit: doctors.length,
                totalPages: 1,
            },
        };
    }
    /**
     * Get doctor by ID with details
     */
    async getDoctorById(doctorId) {
        const doctor = await Appuser_1.AppUser.findOne({
            where: {
                id: doctorId,
                role: "DOCTOR",
            },
            attributes: [
                "id",
                "fullName",
                "email",
                "phone",
                "createdAt",
                "updatedAt",
            ],
        });
        if (!doctor) {
            throw new Error("Doctor not found");
        }
        // Get stats
        const patientCount = await Patient_1.Patient.count({
            where: { doctorId },
        });
        const assistantCount = await Appuser_1.AppUser.count({
            where: {
                role: "ASSISTANT",
                parentId: doctorId,
            },
        });
        const taskCount = await Task_1.Task.count({
            where: { createdBy: doctorId },
        });
        // Get assistants
        const assistants = await Appuser_1.AppUser.findAll({
            where: {
                role: "ASSISTANT",
                parentId: doctorId,
            },
            attributes: ["id", "fullName", "email", "phone", "permissions"],
        });
        return {
            ...doctor.toJSON(),
            stats: {
                totalPatients: patientCount,
                totalAssistants: assistantCount,
                totalTasks: taskCount,
            },
            assistants,
        };
    }
    /**
     * Update doctor details
     */
    async updateDoctor(doctorId, updates) {
        const doctor = await Appuser_1.AppUser.findOne({
            where: {
                id: doctorId,
                role: "DOCTOR",
            },
        });
        if (!doctor) {
            throw new Error("Doctor not found");
        }
        // Allowed updates
        const allowedFields = ["fullName", "email", "phone"];
        const updateData = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                updateData[key] = updates[key];
            }
        }
        await doctor.update(updateData);
        return doctor;
    }
    /**
     * Delete doctor
     */
    async deleteDoctor(doctorId) {
        const doctor = await Appuser_1.AppUser.findOne({
            where: {
                id: doctorId,
                role: "DOCTOR",
            },
        });
        if (!doctor) {
            throw new Error("Doctor not found");
        }
        // Check if doctor has patients
        const patientCount = await Patient_1.Patient.count({
            where: { doctorId },
        });
        if (patientCount > 0) {
            throw new Error(`Cannot delete doctor with ${patientCount} active patients. Please reassign patients first.`);
        }
        // Delete associated assistants first
        await Appuser_1.AppUser.destroy({
            where: {
                role: "ASSISTANT",
                parentId: doctorId,
            },
        });
        await doctor.destroy();
        return {
            message: "Doctor deleted successfully",
        };
    }
    /**
     * Get all assistants (includes isActive for Super Admin status toggle)
     */
    async getAllAssistants(filters = {}, doctorId) {
        const { page = 1, limit = 20, search } = filters;
        const offset = (page - 1) * limit;
        const whereClause = {
            role: "ASSISTANT",
        };
        if (doctorId) {
            whereClause.parentId = doctorId;
        }
        if (search) {
            whereClause[sequelize_1.Op.or] = [
                { fullName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { email: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { phone: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        const { rows: assistants, count: total } = await Appuser_1.AppUser.findAndCountAll({
            where: whereClause,
            attributes: [
                "id",
                "fullName",
                "email",
                "phone",
                "landLinePhone",
                "parentId",
                "permissions",
                "isActive",
                "assistantStatus",
                "patientAccessMode",
                "assignedPatientIds",
                "isEmailVerified",
                "createdAt",
                "updatedAt",
            ],
            include: [
                {
                    model: Appuser_1.AppUser,
                    as: "parent",
                    attributes: ["id", "fullName", "email"],
                },
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });
        // Get task count for each assistant
        const assistantsWithStats = await Promise.all(assistants.map(async (assistant) => {
            let taskCount = 0;
            let pendingTasks = 0;
            try {
                taskCount = await Task_1.Task.count({
                    where: { assignedTo: assistant.id },
                });
                pendingTasks = await Task_1.Task.count({
                    where: {
                        assignedTo: assistant.id,
                        status: { [sequelize_1.Op.in]: ["pending", "in-progress"] },
                    },
                });
            }
            catch {
                // Tasks table may not exist yet
            }
            return {
                ...assistant.toJSON(),
                stats: {
                    totalTasks: taskCount,
                    pendingTasks,
                },
            };
        }));
        return {
            assistants: assistantsWithStats,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Get assistant by ID with details
     */
    async getAssistantById(assistantId) {
        const assistant = await Appuser_1.AppUser.findOne({
            where: {
                id: assistantId,
                role: "ASSISTANT",
            },
            attributes: [
                "id",
                "fullName",
                "email",
                "phone",
                "parentId",
                "permissions",
                "assistantStatus",
                "patientAccessMode",
                "assignedPatientIds",
                "isEmailVerified",
                "createdAt",
                "updatedAt",
            ],
            include: [
                {
                    model: Appuser_1.AppUser,
                    as: "parent",
                    attributes: ["id", "fullName", "email", "phone"],
                },
            ],
        });
        if (!assistant) {
            throw new Error("Assistant not found");
        }
        // Get task stats
        let totalTasks = 0;
        let pendingTasks = 0;
        let completedTasks = 0;
        try {
            totalTasks = await Task_1.Task.count({
                where: { assignedTo: assistantId },
            });
            pendingTasks = await Task_1.Task.count({
                where: { assignedTo: assistantId, status: "pending" },
            });
            completedTasks = await Task_1.Task.count({
                where: { assignedTo: assistantId, status: "completed" },
            });
        }
        catch {
            // Tasks table may not exist yet
        }
        return {
            ...assistant.toJSON(),
            stats: {
                totalTasks,
                pendingTasks,
                completedTasks,
            },
        };
    }
    /**
     * Update assistant details
     */
    async updateAssistant(assistantId, updates) {
        const assistant = await Appuser_1.AppUser.findOne({
            where: {
                id: assistantId,
                role: "ASSISTANT",
            },
        });
        if (!assistant) {
            throw new Error("Assistant not found");
        }
        // Allowed updates for assistants
        const allowedFields = [
            "fullName", "email", "phone", "permissions",
            "assistantStatus", "patientAccessMode", "assignedPatientIds",
        ];
        const updateData = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                updateData[key] = updates[key];
            }
        }
        // Sync isActive with assistantStatus for Super Admin visibility
        if (updateData.assistantStatus === "ON_HOLD") {
            updateData.isActive = false; // Doctor Hold → Super Admin sees Inactive
        }
        else if (updateData.assistantStatus === "ACTIVE") {
            updateData.isActive = true; // Doctor Reactivate → Super Admin sees Active
        }
        await assistant.update(updateData);
        return assistant;
    }
    /**
     * Soft-delete assistant.
     * Sets assistantStatus to DELETED, then uses Sequelize paranoid destroy
     * so the row keeps its deletedAt timestamp. All activity logs and
     * historical references (tasks, audit_logs) remain intact.
     */
    async deleteAssistant(assistantId, deletedByUserId) {
        const assistant = await Appuser_1.AppUser.findOne({
            where: {
                id: assistantId,
                role: "ASSISTANT",
            },
        });
        if (!assistant) {
            throw new Error("Assistant not found");
        }
        // Mark status as DELETED before soft-destroying
        await assistant.update({ assistantStatus: "DELETED" });
        // Paranoid destroy sets deletedAt (row stays in DB)
        await assistant.destroy();
        // Log the deletion in audit_logs for permanent record
        try {
            await AuditLog_1.AuditLog.create({
                userId: deletedByUserId || assistantId,
                userRole: "doctor",
                action: "DELETE_ASSISTANT",
                details: {
                    assistantId,
                    assistantName: assistant.fullName,
                    assistantEmail: assistant.email,
                    parentId: assistant.parentId,
                },
                ipAddress: "system",
            });
        }
        catch {
            // Audit log failure should not block the deletion
        }
        return {
            message: "Assistant archived successfully. Records preserved.",
        };
    }
    /**
     * Get all archived (soft-deleted) assistants.
     * Uses paranoid: false to include rows with deletedAt set.
     */
    async getArchivedAssistants(filters = {}, doctorId) {
        const { page = 1, limit = 20, search } = filters;
        const offset = (page - 1) * limit;
        const whereClause = {
            role: "ASSISTANT",
            assistantStatus: "DELETED",
            deletedAt: { [sequelize_1.Op.ne]: null },
        };
        if (doctorId) {
            whereClause.parentId = doctorId;
        }
        if (search) {
            whereClause[sequelize_1.Op.or] = [
                { fullName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { email: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { phone: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        const { rows: assistants, count: total } = await Appuser_1.AppUser.findAndCountAll({
            where: whereClause,
            attributes: [
                "id", "fullName", "email", "phone", "parentId",
                "permissions", "assistantStatus", "patientAccessMode",
                "assignedPatientIds", "isEmailVerified",
                "createdAt", "updatedAt", "deletedAt",
            ],
            include: [
                {
                    model: Appuser_1.AppUser,
                    as: "parent",
                    attributes: ["id", "fullName", "email"],
                },
            ],
            order: [["deletedAt", "DESC"]],
            limit,
            offset,
            paranoid: false,
        });
        return {
            assistants: assistants.map((a) => a.toJSON()),
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Restore an archived (soft-deleted) assistant.
     * Clears deletedAt and sets assistantStatus back to ACTIVE.
     */
    async restoreAssistant(assistantId) {
        const assistant = await Appuser_1.AppUser.findOne({
            where: {
                id: assistantId,
                role: "ASSISTANT",
            },
            paranoid: false,
        });
        if (!assistant) {
            throw new Error("Assistant not found");
        }
        if (!assistant.deletedAt) {
            throw new Error("Assistant is not archived");
        }
        await assistant.restore();
        // Restore to ON_HOLD — doctor must explicitly reactivate.
        await assistant.update({ assistantStatus: "ON_HOLD" });
        return {
            message: "Assistant restored successfully. Please reactivate to allow login.",
            assistant: assistant.toJSON(),
        };
    }
    /**
     * Toggle a user's active/inactive status (SUPER_ADMIN, DOCTOR, or VENDOR).
     * Prevents self-deactivation.
     */
    async toggleUserStatus(userId, toggledByUserId) {
        if (userId === toggledByUserId) {
            throw new Error("You cannot deactivate your own account");
        }
        const user = await Appuser_1.AppUser.findOne({
            where: {
                id: userId,
                role: { [sequelize_1.Op.in]: ["SUPER_ADMIN", "DOCTOR", "VENDOR", "ASSISTANT"] },
            },
            paranoid: false,
        });
        if (!user) {
            // Check if it's a Patient
            const patient = await Patient_1.Patient.findByPk(userId);
            if (patient) {
                const newStatus = patient.status === "INACTIVE" ? "ACTIVE" : "INACTIVE";
                // JWT is stateless and cannot be revoked directly.
                // Incrementing tokenVersion invalidates all previously issued patient tokens.
                const shouldRotateTokenVersion = newStatus === "INACTIVE";
                await patient.update({
                    status: newStatus,
                    ...(shouldRotateTokenVersion
                        ? { tokenVersion: (patient.tokenVersion ?? 0) + 1 }
                        : {}),
                });
                try {
                    await AuditLog_1.AuditLog.create({
                        userId: toggledByUserId,
                        userRole: "super_admin",
                        action: newStatus === "ACTIVE" ? "USER_ACTIVATED" : "USER_DEACTIVATED",
                        details: {
                            targetUserId: userId,
                            targetName: patient.fullName,
                            targetRole: "PATIENT",
                            newStatus: newStatus === "ACTIVE" ? "active" : "inactive",
                        },
                        ipAddress: "system",
                    });
                }
                catch {
                    // Audit log failure should not block the operation
                }
                return {
                    message: `PATIENT ${newStatus === "ACTIVE" ? "activated" : "deactivated"} successfully.`,
                    user: {
                        id: patient.id,
                        fullName: patient.fullName,
                        role: "PATIENT",
                        isActive: newStatus === "ACTIVE",
                    },
                };
            }
            throw new Error("User not found");
        }
        const newStatus = !user.isActive;
        // Sync assistantStatus with isActive for Doctor visibility
        const assistantStatusSync = user.role === "ASSISTANT"
            ? { assistantStatus: newStatus ? "ACTIVE" : "ON_HOLD" }
            : {};
        // If activating a soft-deleted user, seamlessly restore them FIRST
        if (newStatus && user.deletedAt) {
            await user.restore();
        }
        await user.update({
            isActive: newStatus,
            ...assistantStatusSync,
            ...(newStatus === false
                ? { tokenVersion: (user.tokenVersion ?? 0) + 1 }
                : {}),
        });
        try {
            await AuditLog_1.AuditLog.create({
                userId: toggledByUserId,
                userRole: "super_admin",
                action: newStatus ? "USER_ACTIVATED" : "USER_DEACTIVATED",
                details: {
                    targetUserId: userId,
                    targetName: user.fullName,
                    targetEmail: user.email,
                    targetRole: user.role,
                    newStatus: newStatus ? "active" : "inactive",
                },
                ipAddress: "system",
            });
        }
        catch {
            // Audit log failure should not block the operation
        }
        return {
            message: `${user.role} user ${newStatus ? "activated" : "deactivated"} successfully.`,
            user: {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                isActive: newStatus,
            },
        };
    }
    /**
     * Soft-delete a user (SUPER_ADMIN, DOCTOR, or VENDOR).
     * Prevents self-archiving. Uses Sequelize paranoid destroy.
     */
    async archiveUser(userId, archivedByUserId) {
        if (userId === archivedByUserId) {
            throw new Error("You cannot archive your own account");
        }
        const user = await Appuser_1.AppUser.findOne({
            where: {
                id: userId,
                role: { [sequelize_1.Op.in]: ["SUPER_ADMIN", "DOCTOR", "VENDOR", "ASSISTANT"] },
            },
        });
        if (!user) {
            throw new Error("User not found");
        }
        await user.update({ isActive: false });
        await user.destroy(); // paranoid soft-delete
        try {
            await AuditLog_1.AuditLog.create({
                userId: archivedByUserId,
                userRole: "super_admin",
                action: "USER_ARCHIVED",
                details: {
                    targetUserId: userId,
                    targetName: user.fullName,
                    targetEmail: user.email,
                    targetRole: user.role,
                },
                ipAddress: "system",
            });
        }
        catch {
            // Audit log failure should not block the operation
        }
        return {
            message: `${user.role} user archived successfully. Records preserved.`,
        };
    }
    /**
     * Get all archived (soft-deleted) users (SUPER_ADMIN, DOCTOR, VENDOR).
     */
    async getArchivedUsers(filters = {}) {
        const { page = 1, limit = 20, search } = filters;
        const offset = (page - 1) * limit;
        const whereClause = {
            role: { [sequelize_1.Op.in]: ["SUPER_ADMIN", "DOCTOR", "VENDOR", "ASSISTANT"] },
            deletedAt: { [sequelize_1.Op.ne]: null },
        };
        if (search) {
            whereClause[sequelize_1.Op.or] = [
                { fullName: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { email: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { phone: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        const { rows: users, count: total } = await Appuser_1.AppUser.findAndCountAll({
            where: whereClause,
            attributes: [
                "id", "fullName", "email", "phone", "role",
                "hospital", "specialization", "license", "location", "GST",
                "isActive", "createdAt", "updatedAt", "deletedAt",
            ],
            order: [["deletedAt", "DESC"]],
            limit,
            offset,
            paranoid: false,
        });
        return {
            users: users.map((u) => u.toJSON()),
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Restore an archived (soft-deleted) user.
     * Clears deletedAt and sets isActive back to true.
     */
    async restoreUser(userId) {
        const user = await Appuser_1.AppUser.findOne({
            where: {
                id: userId,
                role: { [sequelize_1.Op.in]: ["SUPER_ADMIN", "DOCTOR", "VENDOR", "ASSISTANT"] },
            },
            paranoid: false,
        });
        if (!user) {
            throw new Error("User not found");
        }
        if (!user.deletedAt) {
            throw new Error("User is not archived");
        }
        await user.restore();
        // Force isActive = false — admin must explicitly activate after restore.
        await user.update({ isActive: false });
        return {
            message: `${user.role} user restored successfully. Please activate the account to allow login.`,
            user: user.toJSON(),
        };
    }
    // ==================== USER PROFILE VIEW & EDIT ====================
    /**
     * Get any user (SUPER_ADMIN, DOCTOR, VENDOR) by ID with role-specific stats.
     */
    async getUserById(userId) {
        // First try AppUser table (Super Admin, Doctor, Vendor, Assistant)
        const user = await Appuser_1.AppUser.findOne({
            where: {
                id: userId,
                role: { [sequelize_1.Op.in]: ["SUPER_ADMIN", "DOCTOR", "VENDOR", "ASSISTANT"] },
            },
            attributes: [
                "id", "fullName", "email", "phone", "landLinePhone", "role",
                "hospital", "specialization", "license", "GST", "location",
                "address", "city", "state",
                "commissionType", "commissionRate", "cashfreeVendorId",
                "isActive", "isEmailVerified", "createdAt", "updatedAt",
                "parentId", "assistantStatus", "deletedAt",
            ],
            paranoid: false, // include archived (soft-deleted) users
        });
        if (user) {
            const result = { ...user.toJSON() };
            // Add role-specific stats
            if (user.role === "DOCTOR") {
                const patientCount = await Patient_1.Patient.count({ where: { doctorId: userId } });
                const assistantCount = await Appuser_1.AppUser.count({
                    where: { role: "ASSISTANT", parentId: userId },
                });
                let taskCount = 0;
                try {
                    taskCount = await Task_1.Task.count({ where: { createdBy: userId } });
                }
                catch {
                    // Tasks table may not exist
                }
                result.stats = { totalPatients: patientCount, totalAssistants: assistantCount, totalTasks: taskCount };
            }
            // Assistant: include parent doctor name
            if (user.role === "ASSISTANT" && user.parentId) {
                const parentDoctor = await Appuser_1.AppUser.findByPk(user.parentId, { attributes: ["id", "fullName"] });
                if (parentDoctor) {
                    result.doctorName = parentDoctor.fullName;
                    result.doctorId = parentDoctor.id;
                }
            }
            return result;
        }
        // Fallback: check Patient table
        const patient = await Patient_1.Patient.findByPk(userId);
        if (patient) {
            const result = {
                id: patient.id,
                fullName: patient.fullName,
                email: "",
                phone: patient.phone || "",
                role: "PATIENT",
                isActive: patient.status !== "INACTIVE",
                isEmailVerified: false,
                createdAt: patient.createdAt,
                updatedAt: patient.updatedAt,
                diaryId: patient.diaryId,
                caseType: patient.caseType,
                patientStatus: patient.status,
                age: patient.age,
                gender: patient.gender,
                address: patient.address,
            };
            if (patient.doctorId) {
                const doctor = await Appuser_1.AppUser.findByPk(patient.doctorId, { attributes: ["id", "fullName"] });
                if (doctor) {
                    result.doctorName = doctor.fullName;
                    result.doctorId = doctor.id;
                }
            }
            return result;
        }
        throw new Error("User not found");
    }
    /**
     * Update any user (SUPER_ADMIN, DOCTOR, VENDOR) by ID.
     * Role is never editable. Prevents self-role modification.
     * Supports optional password reset (model hooks handle hashing).
     */
    async updateUser(userId, updates, requesterId) {
        const user = await Appuser_1.AppUser.findOne({
            where: {
                id: userId,
                role: { [sequelize_1.Op.in]: ["SUPER_ADMIN", "DOCTOR", "VENDOR", "ASSISTANT"] },
            },
        });
        if (!user) {
            throw new Error("User not found");
        }
        // Allowed fields for update (role is NEVER allowed)
        const allowedFields = [
            "fullName", "phone", "landLinePhone", "hospital", "specialization",
            "license", "GST", "location", "address", "city", "state",
            "commissionType", "commissionRate", "password",
        ];
        const updateData = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined && updates[key] !== "") {
                updateData[key] = updates[key];
            }
        }
        if (Object.keys(updateData).length === 0) {
            throw new Error("No valid fields to update");
        }
        await user.update(updateData);
        // Audit log
        try {
            await AuditLog_1.AuditLog.create({
                userId: requesterId,
                userRole: "super_admin",
                action: "USER_UPDATED",
                details: {
                    targetUserId: userId,
                    targetName: user.fullName,
                    targetRole: user.role,
                    updatedFields: Object.keys(updateData),
                },
                ipAddress: "system",
            });
        }
        catch {
            // Audit log failure should not block the operation
        }
        // Return updated user WITHOUT password
        const updated = await Appuser_1.AppUser.findByPk(userId, {
            attributes: [
                "id", "fullName", "email", "phone", "landLinePhone", "role",
                "hospital", "specialization", "license", "GST", "location",
                "address", "city", "state",
                "commissionType", "commissionRate", "cashfreeVendorId",
                "isActive", "isEmailVerified", "createdAt", "updatedAt",
            ],
        });
        return updated?.toJSON();
    }
    // ==================== SELF-REGISTRATION APPROVALS ====================
    async getPendingRegistrations() {
        const doctors = await Appuser_1.AppUser.findAll({
            where: { role: "DOCTOR", isActive: false, selfRegistered: true },
            attributes: ["id", "fullName", "email", "phone", "address", "city", "state", "createdAt"],
            order: [["createdAt", "ASC"]],
        });
        return doctors.map((d) => d.toJSON());
    }
    async approveRegistration(userId, _reviewerId) {
        const doctor = await Appuser_1.AppUser.findOne({
            where: { id: userId, role: "DOCTOR", selfRegistered: true, isActive: false },
        });
        if (!doctor)
            throw new Error("Pending registration not found");
        await doctor.update({ isActive: true, selfRegistered: false });
        return { id: doctor.id, fullName: doctor.fullName, email: doctor.email };
    }
    async rejectRegistration(userId, _reviewerId) {
        const doctor = await Appuser_1.AppUser.findOne({
            where: { id: userId, role: "DOCTOR", selfRegistered: true, isActive: false },
        });
        if (!doctor)
            throw new Error("Pending registration not found");
        await doctor.destroy(); // soft-delete via paranoid
        return { id: userId };
    }
}
exports.staffService = new StaffService();
