import { Op, literal } from "sequelize";
import { SavedFilter } from "../models/SavedFilter";
import { AppUser } from "../models/Appuser";

const creatorInclude = {
  model: AppUser,
  as: "creator",
  attributes: ["id", "fullName", "role"],
};

export interface CreateSavedFilterPayload {
  name: string;
  description?: string;
  color?: string;
  createdBy: string;
  creatorRole: "DOCTOR" | "SUPER_ADMIN";
  scope: "personal" | "global";
  assignedDoctorIds?: string[];
  filterConfig: object;
}

class SavedFilterRepository {
  async create(payload: CreateSavedFilterPayload): Promise<SavedFilter> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (SavedFilter as any).create({
      name: payload.name,
      description: payload.description,
      color: payload.color,
      createdBy: payload.createdBy,
      creatorRole: payload.creatorRole,
      scope: payload.scope,
      assignedDoctorIds: payload.assignedDoctorIds ?? [],
      filterConfig: payload.filterConfig,
      usageCount: 0,
      isActive: true,
    });
  }

  /**
   * Filters visible to a DOCTOR:
   *   1) Their own personal filters
   *   2) Global filters explicitly assigned to them (JSON array contains their ID)
   *   3) Global filters with an empty assignedDoctorIds = visible to ALL doctors
   */
  async findForDoctor(doctorId: string): Promise<SavedFilter[]> {
    const escapedId = doctorId.replace(/['"\\]/g, ""); // basic safety
    return SavedFilter.findAll({
      where: {
        isActive: true,
        [Op.or]: [
          // Own personal filters
          { createdBy: doctorId, scope: "personal" },
          // Global → assigned specifically to this doctor
          literal(`("scope" = 'global' AND "assignedDoctorIds" @> '["${escapedId}"]'::jsonb)`),
          // Global → assigned to ALL doctors (empty array)
          literal(`("scope" = 'global' AND "assignedDoctorIds" = '[]'::jsonb)`),
        ],
      },
      include: [creatorInclude],
      order: [["createdAt", "DESC"]],
    });
  }

  async findAll(): Promise<SavedFilter[]> {
    return SavedFilter.findAll({
      where: { isActive: true },
      include: [creatorInclude],
      order: [["createdAt", "DESC"]],
    });
  }

  async findById(id: string): Promise<SavedFilter | null> {
    return SavedFilter.findByPk(id, { include: [creatorInclude] });
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      color: string;
      filterConfig: object;
      assignedDoctorIds: string[];
      scope: "personal" | "global";
      isActive: boolean;
    }>
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (SavedFilter as any).update(data, { where: { id } });
  }

  async delete(id: string): Promise<void> {
    await SavedFilter.update({ isActive: false }, { where: { id } });
  }

  async incrementUsage(id: string): Promise<void> {
    await SavedFilter.increment("usageCount", { where: { id } });
  }
}

export const savedFilterRepository = new SavedFilterRepository();
