import { Response } from "express";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { dashboardService } from "../service/dashboard.service";
import { sendResponse, sendError } from "../utils/response";
import { AuthRequest } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

/**
 * GET /api/v1/dashboard/patients
 * Returns patients based on user role:
 * - Doctor: their own patients
 * - Assistant: parent Doctor's patients
 * - Vendor: all patients (works on behalf of pharmacist)
 */
export const getPatients = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;

        const offset = (Number(page) - 1) * Number(limit);

        let whereClause: any = {};

        // Determine which patients to show based on role
        if (req.user!.role === UserRole.DOCTOR) {
            // Doctor sees their own patients
            whereClause.doctorId = req.user!.id;
        } else if (req.user!.role === UserRole.ASSISTANT) {
            // Assistant sees parent Doctor's patients
            if (!req.user!.parentId) {
                res.status(400).json({
                    success: false,
                    message: "Assistant is not linked to a Doctor",
                });
                return;
            }
            whereClause.doctorId = req.user!.parentId;
        } else if (req.user!.role === UserRole.VENDOR) {
            // Vendor sees all patients (acts on behalf of pharmacist)
            // NOTE: Can be scoped later with a VendorDoctor mapping table
        } else {
            res.status(403).json({
                success: false,
                message: "Unauthorized access",
            });
            return;
        }

        // Add status filter if provided
        if (status) {
            whereClause.status = status;
        }

        // Add search filter if provided
        if (search) {
            whereClause.fullName = {
                [require("sequelize").Op.iLike]: `%${search}%`,
            };
        }

        // Fetch patients with pagination
        const { rows: patients, count: total } = await Patient.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: AppUser,
                    as: "doctor",
                    attributes: ["id", "fullName", "email"],
                },
            ],
            limit: Number(limit),
            offset,
            order: [["createdAt", "DESC"]],
        });

        res.status(200).json({
            success: true,
            message: "Patients retrieved successfully",
            data: {
                patients,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / Number(limit)),
                },
            },
        });
    } catch (error: any) {
        console.error("Get patients error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to retrieve patients",
        });
    }
};

/**
 * GET /api/v1/dashboard/super-admin
 * Get Super Admin dashboard statistics
 */
export const getSuperAdminDashboard = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const role = req.user?.role;

        if (role !== "SUPER_ADMIN") {
            sendError(res, "Unauthorized: Only Super Admins can access this dashboard", 403);
            return;
        }

        const stats = await dashboardService.getSuperAdminDashboard();
        sendResponse(res, stats, "Super Admin dashboard fetched successfully");
    } catch (error: any) {
        sendError(res, error.message);
    }
};
export const getAllSuperAdmins = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const role = req.user?.role;

        if (role !== "SUPER_ADMIN") {
            sendError(res, "Unauthorized: Only Super Admins can access this dashboard", 403);
            return;
        }

        const stats = await dashboardService.getAllSuperAdmins();
        sendResponse(res, stats, "Super Admins retrieved successfully");
    } catch (error: any) {
        sendError(res, error.message);
    }
};

/**
 * GET /api/v1/dashboard/vendor
 * Get Vendor dashboard statistics
 */
export const getVendorDashboard = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const vendorId = req.user?.id;
        const role = req.user?.role;

        if (!vendorId || role !== "VENDOR") {
            sendError(res, "Unauthorized: Only Vendors can access this dashboard", 403);
            return;
        }

        const stats = await dashboardService.getVendorDashboard(vendorId);
        sendResponse(res, stats, "Vendor dashboard fetched successfully");
    } catch (error: any) {
        sendError(res, error.message);
    }
};

/**
 * GET /api/v1/dashboard/doctor
 * Get Doctor dashboard statistics
 */
export const getDoctorDashboard = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const doctorId = req.user?.id;
        const role = req.user?.role;

        if (!doctorId || role !== "DOCTOR") {
            sendError(res, "Unauthorized: Only Doctors can access this dashboard", 403);
            return;
        }

        const stats = await dashboardService.getDoctorDashboard(doctorId);
        sendResponse(res, stats, "Doctor dashboard fetched successfully");
    } catch (error: any) {
        sendError(res, error.message);
    }
};

/**
 * GET /api/v1/dashboard/assistant
 * Get Assistant dashboard statistics
 */
export const getAssistantDashboard = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const assistantId = req.user?.id;
        const role = req.user?.role;

        if (!assistantId || role !== "ASSISTANT") {
            sendError(res, "Unauthorized: Only Assistants can access this dashboard", 403);
            return;
        }

        const stats = await dashboardService.getAssistantDashboard(assistantId);
        sendResponse(res, stats, "Assistant dashboard fetched successfully");
    } catch (error: any) {
        sendError(res, error.message);
    }
};
