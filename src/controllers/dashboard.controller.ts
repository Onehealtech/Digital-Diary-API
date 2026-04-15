import { Response } from "express";
import { Op } from "sequelize";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { DoctorPatientHistory } from "../models/DoctorPatientHistory";
import { AuthenticatedRequest, AuthRequest } from "../middleware/authMiddleware";
import { dashboardService } from "../service/dashboard.service";
import { sendResponse, sendError } from "../utils/response";
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

    const role = req.user!.role;

    /**
     * SUPER ADMIN → all patients
     */
    if (role === UserRole.SUPER_ADMIN) {
      // no filter
    }

    /**
     * DOCTOR → current patients + historical patients (transferred away)
     */
    else if (role === UserRole.DOCTOR) {
      // Find patients previously assigned to this doctor (now transferred)
      const historicalRecords = await DoctorPatientHistory.findAll({
        where: { doctorId: req.user!.id, unassignedAt: { [Op.ne]: null } },
        attributes: ["patientId"],
      });
      const historicalPatientIds = historicalRecords.map((r) => r.patientId);

      whereClause[Op.or] = [
        { doctorId: req.user!.id },
        ...(historicalPatientIds.length > 0
          ? [{ id: { [Op.in]: historicalPatientIds } }]
          : []),
      ];
    }

    /**
     * ASSISTANT → doctor's patients
     */
    else if (role === UserRole.ASSISTANT) {
      if (!req.user!.parentId) {
        res.status(400).json({
          success: false,
          message: "Assistant is not linked to a Doctor",
        });
        return;
      }

      whereClause.doctorId = req.user!.parentId;

      if (req.user!.patientAccessMode === "selected") {
        const assigned: string[] = req.user!.assignedPatientIds || [];

        if (assigned.length > 0) {
          whereClause.id = { [Op.in]: assigned };
        } else {
          whereClause.id = null;
        }
      }
    }

    /**
     * VENDOR → all patients
     */
    else if (role === UserRole.VENDOR) {
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
        [Op.iLike]: `%${search}%`,
      };
    }

    /**
     * FETCH DATA
     */
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

    // For doctors: enrich each patient with assignment period info
    let enrichedPatients = patients.map((p) => p.toJSON());

    if (role === UserRole.DOCTOR) {
      const myDoctorId = req.user!.id;
      const patientIds = patients.map((p) => p.id);

      // Get all history records for these patients with this doctor
      const historyRecords = await DoctorPatientHistory.findAll({
        where: { doctorId: myDoctorId, patientId: { [Op.in]: patientIds } },
        order: [["assignedAt", "DESC"]],
      });

      const historyMap = new Map<string, { assignedAt: Date; unassignedAt: Date | null }>();
      for (const h of historyRecords) {
        // Use the most recent record per patient
        if (!historyMap.has(h.patientId)) {
          historyMap.set(h.patientId, {
            assignedAt: h.assignedAt,
            unassignedAt: h.unassignedAt || null,
          });
        }
      }

      enrichedPatients = enrichedPatients.map((p: any) => {
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

