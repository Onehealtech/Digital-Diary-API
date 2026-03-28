import { AppUser } from "../models/Appuser";
import { Patient } from "../models/Patient";
import { Task } from "../models/Task";
import { AuditLog } from "../models/AuditLog";
import { Op } from "sequelize";

interface StaffFilters {
  page?: number;
  limit?: number;
  search?: string;
}

class StaffService {
  /**
   * Get all doctors
   */
  async getAllDoctors(filters: StaffFilters = {}) {
    const { page = 1, limit = 20, search } = filters;
    const offset = (page - 1) * limit;

    const whereClause: any = {
      role: "DOCTOR",
    };

    if (search) {
      whereClause[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows: doctors, count: total } = await AppUser.findAndCountAll({
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
    const doctorsWithStats = await Promise.all(
      doctors.map(async (doctor) => {
        const patientCount = await Patient.count({
          where: { doctorId: doctor.id },
        });

        const assistantCount = await AppUser.count({
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
      })
    );

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
async getVendorDoctors(
  vendorId: string,
  filters: StaffFilters = {}
) {
  if (!vendorId) {
    throw new Error("Vendor id is required");
  }

  // Uses VendorDoctor junction table via doctorOnboard service
  const { doctorOnboardService } = await import("./doctorOnboard.service");
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
  async getDoctorById(doctorId: string) {
    const doctor = await AppUser.findOne({
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
    const patientCount = await Patient.count({
      where: { doctorId },
    });

    const assistantCount = await AppUser.count({
      where: {
        role: "ASSISTANT",
        parentId: doctorId,
      },
    });

    const taskCount = await Task.count({
      where: { createdBy: doctorId },
    });

    // Get assistants
    const assistants = await AppUser.findAll({
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
  async updateDoctor(doctorId: string, updates: Partial<AppUser>) {
    const doctor = await AppUser.findOne({
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
    const updateData: any = {};

    for (const key of allowedFields) {
      if (updates[key as keyof AppUser] !== undefined) {
        updateData[key] = updates[key as keyof AppUser];
      }
    }

    await doctor.update(updateData);

    return doctor;
  }

  /**
   * Delete doctor
   */
  async deleteDoctor(doctorId: string) {
    const doctor = await AppUser.findOne({
      where: {
        id: doctorId,
        role: "DOCTOR",
      },
    });

    if (!doctor) {
      throw new Error("Doctor not found");
    }

    // Check if doctor has patients
    const patientCount = await Patient.count({
      where: { doctorId },
    });

    if (patientCount > 0) {
      throw new Error(
        `Cannot delete doctor with ${patientCount} active patients. Please reassign patients first.`
      );
    }

    // Delete associated assistants first
    await AppUser.destroy({
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
  async getAllAssistants(filters: StaffFilters = {}, doctorId?: string) {
    const { page = 1, limit = 20, search } = filters;
    const offset = (page - 1) * limit;

    const whereClause: any = {
      role: "ASSISTANT",
    };

    if (doctorId) {
      whereClause.parentId = doctorId;
    }

    if (search) {
      whereClause[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows: assistants, count: total } = await AppUser.findAndCountAll({
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
          model: AppUser,
          as: "parent",
          attributes: ["id", "fullName", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    // Get task count for each assistant
    const assistantsWithStats = await Promise.all(
      assistants.map(async (assistant) => {
        let taskCount = 0;
        let pendingTasks = 0;
        try {
          taskCount = await Task.count({
            where: { assignedTo: assistant.id },
          });
          pendingTasks = await Task.count({
            where: {
              assignedTo: assistant.id,
              status: { [Op.in]: ["pending", "in-progress"] },
            },
          });
        } catch {
          // Tasks table may not exist yet
        }

        return {
          ...assistant.toJSON(),
          stats: {
            totalTasks: taskCount,
            pendingTasks,
          },
        };
      })
    );

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
  async getAssistantById(assistantId: string) {
    const assistant = await AppUser.findOne({
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
          model: AppUser,
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
      totalTasks = await Task.count({
        where: { assignedTo: assistantId },
      });
      pendingTasks = await Task.count({
        where: { assignedTo: assistantId, status: "pending" },
      });
      completedTasks = await Task.count({
        where: { assignedTo: assistantId, status: "completed" },
      });
    } catch {
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
  async updateAssistant(assistantId: string, updates: Partial<AppUser>) {
    const assistant = await AppUser.findOne({
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
    const updateData: any = {};

    for (const key of allowedFields) {
      if (updates[key as keyof AppUser] !== undefined) {
        updateData[key] = updates[key as keyof AppUser];
      }
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
  async deleteAssistant(assistantId: string, deletedByUserId?: string) {
    const assistant = await AppUser.findOne({
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
      await AuditLog.create({
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
    } catch {
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
  async getArchivedAssistants(filters: StaffFilters = {}, doctorId?: string) {
    const { page = 1, limit = 20, search } = filters;
    const offset = (page - 1) * limit;

    const whereClause: any = {
      role: "ASSISTANT",
      assistantStatus: "DELETED",
      deletedAt: { [Op.ne]: null },
    };

    if (doctorId) {
      whereClause.parentId = doctorId;
    }

    if (search) {
      whereClause[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows: assistants, count: total } = await AppUser.findAndCountAll({
      where: whereClause,
      attributes: [
        "id", "fullName", "email", "phone", "parentId",
        "permissions", "assistantStatus", "patientAccessMode",
        "assignedPatientIds", "isEmailVerified",
        "createdAt", "updatedAt", "deletedAt",
      ],
      include: [
        {
          model: AppUser,
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
  async restoreAssistant(assistantId: string) {
    const assistant = await AppUser.findOne({
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
    await assistant.update({ assistantStatus: "ACTIVE" });

    return {
      message: "Assistant restored successfully.",
      assistant: assistant.toJSON(),
    };
  }
  /**
   * Toggle a user's active/inactive status (SUPER_ADMIN, DOCTOR, or VENDOR).
   * Prevents self-deactivation.
   */
  async toggleUserStatus(userId: string, toggledByUserId: string) {
    if (userId === toggledByUserId) {
      throw new Error("You cannot deactivate your own account");
    }

    const user = await AppUser.findOne({
      where: {
        id: userId,
        role: { [Op.in]: ["SUPER_ADMIN", "DOCTOR", "VENDOR", "ASSISTANT"] },
      },
    });

    if (!user) {
      // Check if it's a Patient
      const patient = await Patient.findByPk(userId);
      if (patient) {
        const newStatus = patient.status === "INACTIVE" ? "ACTIVE" : "INACTIVE";
        await patient.update({ status: newStatus });
        try {
          await AuditLog.create({
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
        } catch {
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
    await user.update({ isActive: newStatus });

    try {
      await AuditLog.create({
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
    } catch {
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
  async archiveUser(userId: string, archivedByUserId: string) {
    if (userId === archivedByUserId) {
      throw new Error("You cannot archive your own account");
    }

    const user = await AppUser.findOne({
      where: {
        id: userId,
        role: { [Op.in]: ["SUPER_ADMIN", "DOCTOR", "VENDOR", "ASSISTANT"] },
      },
    });

    if (!user) {
      throw new Error("User not found");
    }

    await user.update({ isActive: false });
    await user.destroy(); // paranoid soft-delete

    try {
      await AuditLog.create({
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
    } catch {
      // Audit log failure should not block the operation
    }

    return {
      message: `${user.role} user archived successfully. Records preserved.`,
    };
  }

  /**
   * Get all archived (soft-deleted) users (SUPER_ADMIN, DOCTOR, VENDOR).
   */
  async getArchivedUsers(filters: StaffFilters = {}) {
    const { page = 1, limit = 20, search } = filters;
    const offset = (page - 1) * limit;

    const whereClause: any = {
      role: { [Op.in]: ["SUPER_ADMIN", "DOCTOR", "VENDOR", "ASSISTANT"] },
      deletedAt: { [Op.ne]: null },
    };

    if (search) {
      whereClause[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows: users, count: total } = await AppUser.findAndCountAll({
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
  async restoreUser(userId: string) {
    const user = await AppUser.findOne({
      where: {
        id: userId,
        role: { [Op.in]: ["SUPER_ADMIN", "DOCTOR", "VENDOR", "ASSISTANT"] },
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
    await user.update({ isActive: true });

    return {
      message: `${user.role} user restored successfully.`,
      user: user.toJSON(),
    };
  }

  // ==================== USER PROFILE VIEW & EDIT ====================

  /**
   * Get any user (SUPER_ADMIN, DOCTOR, VENDOR) by ID with role-specific stats.
   */
  async getUserById(userId: string) {
    // First try AppUser table (Super Admin, Doctor, Vendor, Assistant)
    const user = await AppUser.findOne({
      where: {
        id: userId,
        role: { [Op.in]: ["SUPER_ADMIN", "DOCTOR", "VENDOR", "ASSISTANT"] },
      },
      attributes: [
        "id", "fullName", "email", "phone", "landLinePhone", "role",
        "hospital", "specialization", "license", "GST", "location",
        "address", "city", "state",
        "commissionType", "commissionRate", "cashfreeVendorId",
        "isActive", "isEmailVerified", "createdAt", "updatedAt",
        "parentId", "assistantStatus",
      ],
    });

    if (user) {
      const result: Record<string, unknown> = { ...user.toJSON() };

      // Add role-specific stats
      if (user.role === "DOCTOR") {
        const patientCount = await Patient.count({ where: { doctorId: userId } });
        const assistantCount = await AppUser.count({
          where: { role: "ASSISTANT", parentId: userId },
        });
        let taskCount = 0;
        try {
          taskCount = await Task.count({ where: { createdBy: userId } });
        } catch {
          // Tasks table may not exist
        }
        result.stats = { totalPatients: patientCount, totalAssistants: assistantCount, totalTasks: taskCount };
      }

      // Assistant: include parent doctor name
      if (user.role === "ASSISTANT" && user.parentId) {
        const parentDoctor = await AppUser.findByPk(user.parentId, { attributes: ["id", "fullName"] });
        if (parentDoctor) {
          result.doctorName = parentDoctor.fullName;
          result.doctorId = parentDoctor.id;
        }
      }

      return result;
    }

    // Fallback: check Patient table
    const patient = await Patient.findByPk(userId);
    if (patient) {
      const result: Record<string, unknown> = {
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
        const doctor = await AppUser.findByPk(patient.doctorId, { attributes: ["id", "fullName"] });
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
  async updateUser(
    userId: string,
    updates: Record<string, unknown>,
    requesterId: string
  ) {
    const user = await AppUser.findOne({
      where: {
        id: userId,
        role: { [Op.in]: ["SUPER_ADMIN", "DOCTOR", "VENDOR", "ASSISTANT"] },
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

    const updateData: Record<string, unknown> = {};
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
      await AuditLog.create({
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
    } catch {
      // Audit log failure should not block the operation
    }

    // Return updated user WITHOUT password
    const updated = await AppUser.findByPk(userId, {
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
    const doctors = await AppUser.findAll({
      where: { role: "DOCTOR", isActive: false, selfRegistered: true } as any,
      attributes: ["id", "fullName", "email", "phone", "address", "city", "state", "createdAt"],
      order: [["createdAt", "ASC"]],
    });
    return doctors.map((d) => d.toJSON());
  }

  async approveRegistration(userId: any, _reviewerId: string) {
    const doctor = await AppUser.findOne({
      where: { id: userId, role: "DOCTOR", selfRegistered: true, isActive: false } as any,
    });
    if (!doctor) throw new Error("Pending registration not found");

    await doctor.update({ isActive: true, selfRegistered: false });

    return { id: doctor.id, fullName: doctor.fullName, email: doctor.email };
  }

  async rejectRegistration(userId: any, _reviewerId: string) {
    const doctor = await AppUser.findOne({
      where: { id: userId, role: "DOCTOR", selfRegistered: true, isActive: false } as any,
    });
    if (!doctor) throw new Error("Pending registration not found");

    await doctor.destroy(); // soft-delete via paranoid

    return { id: userId };
  }
}

export const staffService = new StaffService();

