import { Response } from "express";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
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
