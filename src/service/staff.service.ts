import { AppUser } from "../models/Appuser";
import { Patient } from "../models/Patient";
import { Task } from "../models/Task";
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
        "phoneNumber",
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
      attributes: ["id", "fullName", "email", "phoneNumber", "permissions"],
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
    const allowedFields = ["fullName", "email", "phoneNumber"];
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
   * Get all assistants
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
        { phoneNumber: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows: assistants, count: total } = await AppUser.findAndCountAll({
      where: whereClause,
      attributes: [
        "id",
        "fullName",
        "email",
        "phoneNumber",
        "parentId",
        "permissions",
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
        const taskCount = await Task.count({
          where: { assignedTo: assistant.id },
        });

        const pendingTasks = await Task.count({
          where: {
            assignedTo: assistant.id,
            status: { [Op.in]: ["pending", "in-progress"] },
          },
        });

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
        "phoneNumber",
        "parentId",
        "permissions",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: AppUser,
          as: "parent",
          attributes: ["id", "fullName", "email", "phoneNumber"],
        },
      ],
    });

    if (!assistant) {
      throw new Error("Assistant not found");
    }

    // Get task stats
    const totalTasks = await Task.count({
      where: { assignedTo: assistantId },
    });

    const pendingTasks = await Task.count({
      where: {
        assignedTo: assistantId,
        status: "pending",
      },
    });

    const completedTasks = await Task.count({
      where: {
        assignedTo: assistantId,
        status: "completed",
      },
    });

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

    // Allowed updates
    const allowedFields = ["fullName", "email", "phoneNumber", "permissions"];
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
   * Delete assistant
   */
  async deleteAssistant(assistantId: string) {
    const assistant = await AppUser.findOne({
      where: {
        id: assistantId,
        role: "ASSISTANT",
      },
    });

    if (!assistant) {
      throw new Error("Assistant not found");
    }

    // Check if assistant has pending tasks
    const pendingTaskCount = await Task.count({
      where: {
        assignedTo: assistantId,
        status: { [Op.in]: ["pending", "in-progress"] },
      },
    });

    if (pendingTaskCount > 0) {
      throw new Error(
        `Cannot delete assistant with ${pendingTaskCount} pending tasks. Please reassign or complete tasks first.`
      );
    }

    await assistant.destroy();

    return {
      message: "Assistant deleted successfully",
    };
  }
}

export const staffService = new StaffService();
