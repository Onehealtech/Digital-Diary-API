import { z } from "zod";
import { savedFilterRepository } from "../repositories/savedFilterRepository";
import { AppUser } from "../models/Appuser";

// ── Zod schemas ───────────────────────────────────────────────────

export const CreateSavedFilterSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  color: z.string().max(20).optional(),
  /**
   * The filter config — everything from AdvancedAnalysisFilter except
   * page / limit / sortBy (those are UI state, not saved criteria).
   */
  filterConfig: z.record(z.unknown()).refine(
    (v) => v && typeof v === "object",
    "filterConfig must be an object"
  ),
});

export const UpdateSavedFilterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z.string().max(20).optional(),
  filterConfig: z.record(z.unknown()).optional(),
});

export const AssignFilterSchema = z.object({
  doctorIds: z
    .array(z.string().uuid("Each doctor ID must be a valid UUID"))
    .min(0, "At least one doctor required"),
});

// ── Service ───────────────────────────────────────────────────────

class SavedFilterService {
  /**
   * Create a new saved filter.
   * - Doctors create "personal" filters.
   * - Super Admins create "global" filters that can be pushed to doctors.
   */
  async createFilter(
    createdBy: string,
    creatorRole: "DOCTOR" | "SUPER_ADMIN" | string,
    body: unknown
  ) {
    const parsed = CreateSavedFilterSchema.safeParse(body);
    if (!parsed.success) {
      throw { statusCode: 400, message: parsed.error.issues[0].message };
    }

    const role = (creatorRole === "SUPER_ADMIN" ? "SUPER_ADMIN" : "DOCTOR") as
      | "DOCTOR"
      | "SUPER_ADMIN";

    const filter = await savedFilterRepository.create({
      ...parsed.data,
      createdBy,
      creatorRole: role,
      scope: role === "SUPER_ADMIN" ? "global" : "personal",
      filterConfig: parsed.data.filterConfig as object,
    });

    return filter;
  }

  /**
   * List filters visible to the calling user.
   */
  async getFiltersForUser(userId: string, role: string) {
    if (role === "SUPER_ADMIN") {
      return savedFilterRepository.findAll();
    }
    // DOCTOR or ASSISTANT — fetch personal + assigned global
    return savedFilterRepository.findForDoctor(userId);
  }

  /**
   * Get a single filter — access-checked.
   */
  async getFilterById(id: string, userId: string, role: string) {
    const filter = await savedFilterRepository.findById(id);
    if (!filter || !filter.isActive) {
      throw { statusCode: 404, message: "Filter not found" };
    }
    this.assertAccess(filter, userId, role);
    return filter;
  }

  /**
   * Update a filter — only the creator (or Super Admin) can update.
   */
  async updateFilter(
    id: string,
    userId: string,
    role: string,
    body: unknown
  ) {
    const filter = await savedFilterRepository.findById(id);
    if (!filter || !filter.isActive) {
      throw { statusCode: 404, message: "Filter not found" };
    }
    this.assertOwnership(filter, userId, role);

    const parsed = UpdateSavedFilterSchema.safeParse(body);
    if (!parsed.success) {
      throw { statusCode: 400, message: parsed.error.issues[0].message };
    }

    await savedFilterRepository.update(id, {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.color !== undefined && { color: parsed.data.color }),
      ...(parsed.data.filterConfig !== undefined && { filterConfig: parsed.data.filterConfig as object }),
    });

    return savedFilterRepository.findById(id);
  }

  /**
   * Soft-delete a filter — only the creator (or Super Admin) can delete.
   */
  async deleteFilter(id: string, userId: string, role: string) {
    const filter = await savedFilterRepository.findById(id);
    if (!filter || !filter.isActive) {
      throw { statusCode: 404, message: "Filter not found" };
    }
    this.assertOwnership(filter, userId, role);
    await savedFilterRepository.delete(id);
  }

  /**
   * Assign a global filter to specific doctors (Super Admin only).
   * Pass an empty array to make the filter visible to ALL doctors.
   */
  async assignFilter(filterId: string, body: unknown, adminId: string) {
    const filter = await savedFilterRepository.findById(filterId);
    if (!filter || !filter.isActive) {
      throw { statusCode: 404, message: "Filter not found" };
    }
    if (filter.createdBy !== adminId && filter.creatorRole !== "SUPER_ADMIN") {
      throw { statusCode: 403, message: "Only the creating Super Admin can assign this filter" };
    }

    const parsed = AssignFilterSchema.safeParse(body);
    if (!parsed.success) {
      throw { statusCode: 400, message: parsed.error.issues[0].message };
    }

    // Validate that all provided IDs are actual doctors
    if (parsed.data.doctorIds.length > 0) {
      const doctors = await AppUser.findAll({
        where: { id: parsed.data.doctorIds, role: "DOCTOR" },
        attributes: ["id"],
      });
      if (doctors.length !== parsed.data.doctorIds.length) {
        throw { statusCode: 400, message: "One or more provided IDs are not valid doctor accounts" };
      }
    }

    await savedFilterRepository.update(filterId, {
      assignedDoctorIds: parsed.data.doctorIds,
      scope: "global",
    });

    return savedFilterRepository.findById(filterId);
  }

  /**
   * Apply a filter — returns the filterConfig and increments usage counter.
   */
  async applyFilter(id: string, userId: string, role: string) {
    const filter = await this.getFilterById(id, userId, role);
    await savedFilterRepository.incrementUsage(id);
    return { filterConfig: filter.filterConfig };
  }

  /**
   * Super Admin: list all filters across all users.
   */
  async getAllFiltersAdmin() {
    return savedFilterRepository.findAll();
  }

  // ── Private helpers ─────────────────────────────────────────────

  private assertOwnership(
    filter: { createdBy: string },
    userId: string,
    role: string
  ) {
    if (role === "SUPER_ADMIN") return; // Super Admins can modify any filter
    if (filter.createdBy !== userId) {
      throw { statusCode: 403, message: "You do not have permission to modify this filter" };
    }
  }

  private assertAccess(
    filter: { createdBy: string; scope: string; assignedDoctorIds: string[] },
    userId: string,
    role: string
  ) {
    if (role === "SUPER_ADMIN") return;
    if (filter.createdBy === userId) return; // own filter
    if (filter.scope === "global") {
      if (
        filter.assignedDoctorIds.length === 0 || // all doctors
        filter.assignedDoctorIds.includes(userId)
      ) {
        return;
      }
    }
    throw { statusCode: 403, message: "You do not have access to this filter" };
  }
}

export const savedFilterService = new SavedFilterService();
