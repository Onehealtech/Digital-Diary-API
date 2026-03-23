"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssistantDashboard = exports.getDoctorDashboard = exports.getVendorDashboard = exports.getAllSuperAdmins = exports.getSuperAdminDashboard = exports.getPatients = void 0;
const sequelize_1 = require("sequelize");
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const DoctorPatientHistory_1 = require("../models/DoctorPatientHistory");
const dashboard_service_1 = require("../service/dashboard.service");
const response_1 = require("../utils/response");
const constants_1 = require("../utils/constants");
/**
 * GET /api/v1/dashboard/patients
 * Returns patients based on user role:
 * - Doctor: their own patients
 * - Assistant: parent Doctor's patients
 * - Vendor: all patients (works on behalf of pharmacist)
 */
const getPatients = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        let whereClause = {};
        const role = req.user.role;
        /**
         * SUPER ADMIN → all patients
         */
        if (role === constants_1.UserRole.SUPER_ADMIN) {
            // no filter
        }
        /**
         * DOCTOR → current patients + historical patients (transferred away)
         */
        else if (role === constants_1.UserRole.DOCTOR) {
            // Find patients previously assigned to this doctor (now transferred)
            const historicalRecords = await DoctorPatientHistory_1.DoctorPatientHistory.findAll({
                where: { doctorId: req.user.id, unassignedAt: { [sequelize_1.Op.ne]: null } },
                attributes: ["patientId"],
            });
            const historicalPatientIds = historicalRecords.map((r) => r.patientId);
            whereClause[sequelize_1.Op.or] = [
                { doctorId: req.user.id },
                ...(historicalPatientIds.length > 0
                    ? [{ id: { [sequelize_1.Op.in]: historicalPatientIds } }]
                    : []),
            ];
        }
        /**
         * ASSISTANT → doctor's patients
         */
        else if (role === constants_1.UserRole.ASSISTANT) {
            if (!req.user.parentId) {
                res.status(400).json({
                    success: false,
                    message: "Assistant is not linked to a Doctor",
                });
                return;
            }
            whereClause.doctorId = req.user.parentId;
            if (req.user.patientAccessMode === "selected") {
                const assigned = req.user.assignedPatientIds || [];
                if (assigned.length > 0) {
                    whereClause.id = { [sequelize_1.Op.in]: assigned };
                }
                else {
                    whereClause.id = null;
                }
            }
        }
        /**
         * VENDOR → all patients
         */
        else if (role === constants_1.UserRole.VENDOR) {
            // no filter
        }
        else {
            res.status(403).json({
                success: false,
                message: "Unauthorized access",
            });
            return;
        }
        /**
         * STATUS FILTER
         */
        if (status) {
            whereClause.status = status;
        }
        /**
         * SEARCH FILTER
         */
        if (search) {
            whereClause.fullName = {
                [sequelize_1.Op.iLike]: `%${search}%`,
            };
        }
        /**
         * FETCH DATA
         */
        const { rows: patients, count: total } = await Patient_1.Patient.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Appuser_1.AppUser,
                    as: "doctor",
                    attributes: ["id", "fullName", "email"],
                },
            ],
            limit: Number(limit),
            offset,
            order: [["createdAt", "DESC"]],
        });
        // For doctors: enrich each patient with assignment period info
        let enrichedPatients = patients.map((p) => p.toJSON());
        if (role === constants_1.UserRole.DOCTOR) {
            const myDoctorId = req.user.id;
            const patientIds = patients.map((p) => p.id);
            // Get all history records for these patients with this doctor
            const historyRecords = await DoctorPatientHistory_1.DoctorPatientHistory.findAll({
                where: { doctorId: myDoctorId, patientId: { [sequelize_1.Op.in]: patientIds } },
                order: [["assignedAt", "DESC"]],
            });
            const historyMap = new Map();
            for (const h of historyRecords) {
                // Use the most recent record per patient
                if (!historyMap.has(h.patientId)) {
                    historyMap.set(h.patientId, {
                        assignedAt: h.assignedAt,
                        unassignedAt: h.unassignedAt || null,
                    });
                }
            }
            enrichedPatients = enrichedPatients.map((p) => {
                const history = historyMap.get(p.id);
                const isCurrentPatient = p.doctorId === myDoctorId;
                return {
                    ...p,
                    isCurrentPatient,
                    // Old doctor sees "DOCTOR_REASSIGNED" status for transferred patients
                    status: isCurrentPatient ? p.status : "DOCTOR_REASSIGNED",
                    assignmentPeriod: history || null,
                };
            });
        }
        res.status(200).json({
            success: true,
            message: "Patients retrieved successfully",
            data: {
                patients: enrichedPatients,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / Number(limit)),
                },
            },
        });
    }
    catch (error) {
        console.error("Get patients error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to retrieve patients",
        });
    }
};
exports.getPatients = getPatients;
/**
 * GET /api/v1/dashboard/super-admin
 * Get Super Admin dashboard statistics
 */
const getSuperAdminDashboard = async (req, res) => {
    try {
        const role = req.user?.role;
        if (role !== "SUPER_ADMIN") {
            (0, response_1.sendError)(res, "Unauthorized: Only Super Admins can access this dashboard", 403);
            return;
        }
        const stats = await dashboard_service_1.dashboardService.getSuperAdminDashboard();
        (0, response_1.sendResponse)(res, stats, "Super Admin dashboard fetched successfully");
    }
    catch (error) {
        (0, response_1.sendError)(res, error.message);
    }
};
exports.getSuperAdminDashboard = getSuperAdminDashboard;
const getAllSuperAdmins = async (req, res) => {
    try {
        const role = req.user?.role;
        if (role !== "SUPER_ADMIN") {
            (0, response_1.sendError)(res, "Unauthorized: Only Super Admins can access this dashboard", 403);
            return;
        }
        const stats = await dashboard_service_1.dashboardService.getAllSuperAdmins();
        (0, response_1.sendResponse)(res, stats, "Super Admins retrieved successfully");
    }
    catch (error) {
        (0, response_1.sendError)(res, error.message);
    }
};
exports.getAllSuperAdmins = getAllSuperAdmins;
/**
 * GET /api/v1/dashboard/vendor
 * Get Vendor dashboard statistics
 */
const getVendorDashboard = async (req, res) => {
    try {
        const vendorId = req.user?.id;
        const role = req.user?.role;
        if (!vendorId || role !== "VENDOR") {
            (0, response_1.sendError)(res, "Unauthorized: Only Vendors can access this dashboard", 403);
            return;
        }
        const stats = await dashboard_service_1.dashboardService.getVendorDashboard(vendorId);
        (0, response_1.sendResponse)(res, stats, "Vendor dashboard fetched successfully");
    }
    catch (error) {
        (0, response_1.sendError)(res, error.message);
    }
};
exports.getVendorDashboard = getVendorDashboard;
/**
 * GET /api/v1/dashboard/doctor
 * Get Doctor dashboard statistics
 */
const getDoctorDashboard = async (req, res) => {
    try {
        const doctorId = req.user?.id;
        const role = req.user?.role;
        if (!doctorId || role !== "DOCTOR") {
            (0, response_1.sendError)(res, "Unauthorized: Only Doctors can access this dashboard", 403);
            return;
        }
        const stats = await dashboard_service_1.dashboardService.getDoctorDashboard(doctorId);
        (0, response_1.sendResponse)(res, stats, "Doctor dashboard fetched successfully");
    }
    catch (error) {
        (0, response_1.sendError)(res, error.message);
    }
};
exports.getDoctorDashboard = getDoctorDashboard;
/**
 * GET /api/v1/dashboard/assistant
 * Get Assistant dashboard statistics
 */
const getAssistantDashboard = async (req, res) => {
    try {
        const assistantId = req.user?.id;
        const role = req.user?.role;
        if (!assistantId || role !== "ASSISTANT") {
            (0, response_1.sendError)(res, "Unauthorized: Only Assistants can access this dashboard", 403);
            return;
        }
        const stats = await dashboard_service_1.dashboardService.getAssistantDashboard(assistantId);
        (0, response_1.sendResponse)(res, stats, "Assistant dashboard fetched successfully");
    }
    catch (error) {
        (0, response_1.sendError)(res, error.message);
    }
};
exports.getAssistantDashboard = getAssistantDashboard;
