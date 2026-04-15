import { Response } from "express";
import { staffService } from "../service/staff.service";
import { sendResponse, sendError } from "../utils/response";
import { AuthRequest } from "../middleware/authMiddleware";
import { logActivity } from "../utils/activityLogger";

class StaffController {
  // ==================== DOCTOR MANAGEMENT ====================

  /**
   * GET /api/v1/doctors
   * Get all doctors (Super Admin only)
   */
  async getAllDoctors(req: AuthRequest, res: Response) {
    try {
      const role = req.user?.role;

      if (role !== "SUPER_ADMIN") {
        return sendError(res, "Only Super Admins can view all doctors", 403);
      }

      const { page, limit, search } = req.query;

      const result = await staffService.getAllDoctors({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search as string,
      });

      return sendResponse(res, result, "Doctors fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }
  async getVendorDoctors(req: AuthRequest, res: Response) {
    try {
      const role = req.user?.role;
      const vendorId = req.user?.id;

      if (role !== "VENDOR") {
        return sendError(res, "Only Vendors can view their doctors", 403);
      }

      const { page, limit, search } = req.query;

      const result = await staffService.getVendorDoctors(
        vendorId as string,
        {
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
          search: search as string,
        }
      );

      return sendResponse(res, result, "Vendor doctors fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * GET /api/v1/doctors/:id
   * Get doctor by ID
   */
  async getDoctorById(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;
      const role = req.user?.role;

      // Super Admin can open any doctor profile.
      // Doctors can only open their own profile.
      if (!userId || !["SUPER_ADMIN", "DOCTOR"].includes(role || "")) {
        return sendError(res, "Only Doctors and Super Admins can view doctor details", 403);
      }

      if (role === "DOCTOR" && userId !== id) {
        return sendError(res, "You can only view your own doctor profile", 403);
      }

      const doctor = await staffService.getDoctorById(id);

      return sendResponse(res, doctor, "Doctor details fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
  }

  /**
   * PUT /api/v1/doctors/:id
   * Update doctor details
   */
  async updateDoctor(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const role = req.user?.role;

      if (role !== "SUPER_ADMIN") {
        return sendError(res, "Only Super Admins can update doctors", 403);
      }

      const updates = req.body;

      const doctor = await staffService.updateDoctor(id, updates);

      return sendResponse(res, doctor, "Doctor updated successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
  }

  /**
   * DELETE /api/v1/doctors/:id
   * Delete doctor
   */
  async deleteDoctor(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const role = req.user?.role;

      if (role !== "SUPER_ADMIN") {
        return sendError(res, "Only Super Admins can delete doctors", 403);
      }

      const result = await staffService.deleteDoctor(id);

      return sendResponse(res, result, "Doctor deleted successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 400);
    }
  }

  // ==================== ASSISTANT MANAGEMENT ====================

  /**
   * GET /api/v1/assistants
   * Get all assistants
   * Super Admin sees all, Doctor sees their own
   */
  async getAllAssistants(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const role = req.user?.role;

      if (!userId || !["SUPER_ADMIN", "DOCTOR"].includes(role || "")) {
        return sendError(res, "Only Super Admins and Doctors can view assistants", 403);
      }

      const { page, limit, search } = req.query;

      // Doctor can only see their own assistants
      const doctorId = role === "DOCTOR" ? userId : undefined;

      const result = await staffService.getAllAssistants(
        {
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
          search: search as string,
        },
        doctorId
      );

      return sendResponse(res, result, "Assistants fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * GET /api/v1/assistants/:id
   * Get assistant by ID
   */
  async getAssistantById(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;
      const role = req.user?.role;

      if (!userId || !["SUPER_ADMIN", "DOCTOR"].includes(role || "")) {
        return sendError(res, "Only Super Admins and Doctors can view assistant details", 403);
      }

      const assistant = await staffService.getAssistantById(id);

      // If doctor, verify this is their assistant
      if (role === "DOCTOR" && assistant.parentId !== userId) {
        return sendError(res, "You can only view your own assistants", 403);
      }

      return sendResponse(res, assistant, "Assistant details fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
  }

  /**
   * PUT /api/v1/assistants/:id
   * Update assistant details
   */
  async updateAssistant(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;
      const role = req.user?.role;

      if (!userId || !["SUPER_ADMIN", "DOCTOR"].includes(role || "")) {
        return sendError(res, "Only Super Admins and Doctors can update assistants", 403);
      }

      const updates = req.body;

      // If doctor, verify this is their assistant
      if (role === "DOCTOR") {
        const assistant = await staffService.getAssistantById(id);
        if (assistant.parentId !== userId) {
          return sendError(res, "You can only update your own assistants", 403);
        }
      }

      const assistant = await staffService.updateAssistant(id, updates);

      return sendResponse(res, assistant, "Assistant updated successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
  }

  /**
   * DELETE /api/v1/assistants/:id
   * Delete assistant
   */
  async deleteAssistant(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;
      const role = req.user?.role;

      if (!userId || !["SUPER_ADMIN", "DOCTOR"].includes(role || "")) {
        return sendError(res, "Only Super Admins and Doctors can delete assistants", 403);
      }

      // If doctor, verify this is their assistant
      if (role === "DOCTOR") {
        const assistant = await staffService.getAssistantById(id);
        if (assistant.parentId !== userId) {
          return sendError(res, "You can only delete your own assistants", 403);
        }
      }

      const result = await staffService.deleteAssistant(id, userId);

      logActivity({
        req,
        userId: userId!,
        userRole: role!,
        action: "ASSISTANT_ARCHIVED",
        details: { assistantId: id },
      });

      return sendResponse(res, result, "Assistant archived successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 400);
    }
  }

  /**
   * GET /api/v1/assistants/archived
   * Get all archived assistants
   */
  async getArchivedAssistants(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const role = req.user?.role;

      if (!userId || !["SUPER_ADMIN", "DOCTOR"].includes(role || "")) {
        return sendError(res, "Only Super Admins and Doctors can view archived assistants", 403);
      }

      const { page, limit, search } = req.query;
      const doctorId = role === "DOCTOR" ? userId : undefined;

      const result = await staffService.getArchivedAssistants(
        {
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
          search: search as string,
        },
        doctorId
      );

      return sendResponse(res, result, "Archived assistants fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * POST /api/v1/assistants/:id/restore
   * Restore an archived assistant
   */
  async restoreAssistant(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;
      const role = req.user?.role;

      if (!userId || !["SUPER_ADMIN", "DOCTOR"].includes(role || "")) {
        return sendError(res, "Only Super Admins and Doctors can restore assistants", 403);
      }

      // If doctor, verify ownership via paranoid-false lookup
      if (role === "DOCTOR") {
        const { assistants } = await staffService.getArchivedAssistants({}, userId);
        const owns = assistants.some((a: any) => a.id === id);
        if (!owns) {
          return sendError(res, "You can only restore your own assistants", 403);
        }
      }

      const result = await staffService.restoreAssistant(id);

      logActivity({
        req,
        userId: userId!,
        userRole: role!,
        action: "ASSISTANT_RESTORED",
        details: { assistantId: id },
      });

      return sendResponse(res, result, "Assistant restored successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 400);
    }
  }
  // ==================== USER PROFILE VIEW & EDIT ====================

  /**
   * GET /api/v1/users/:id
   * Get user profile by ID (Super Admin only)
   */
  async getUserById(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;
      const role = req.user?.role;

      if (!userId || !["SUPER_ADMIN", "DOCTOR"].includes(role || "")) {
        return sendError(res, "Only Doctors and Super Admins can view user profiles", 403);
      }

      // Doctor profile API can be reused by doctor self-profile screens.
      // Doctors must stay scoped to their own record.
      if (role === "DOCTOR" && userId !== id) {
        return sendError(res, "You can only view your own user profile", 403);
      }

      const user = await staffService.getUserById(id);

      if (role === "DOCTOR" && user.role !== "DOCTOR") {
        return sendError(res, "Access denied", 403);
      }

      return sendResponse(res, user, "User details fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
  }

  /**
   * PUT /api/v1/users/:id
   * Update user profile (Super Admin only)
   */
  async updateUser(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;
      const role = req.user?.role;

      if (role !== "SUPER_ADMIN") {
        return sendError(res, "Only Super Admins can update user profiles", 403);
      }

      const updates = req.body;

      const user = await staffService.updateUser(id, updates, userId!);

      logActivity({
        req,
        userId: userId!,
        userRole: role!,
        action: "USER_UPDATED",
        details: { targetUserId: id, updatedFields: Object.keys(updates) },
      });

      return sendResponse(res, user, "User updated successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 500);
    }
  }

  // ==================== USER STATUS TOGGLE ====================

  /**
   * PUT /api/v1/users/:id/toggle-status
   * Toggle a user's active/inactive status. Super Admin only. Cannot deactivate self.
   */
  async toggleUserStatus(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;
      const role = req.user?.role;

      if (role !== "SUPER_ADMIN") {
        return sendError(res, "Only Super Admins can toggle user status", 403);
      }

      const result = await staffService.toggleUserStatus(id, userId!);

      logActivity({
        req,
        userId: userId!,
        userRole: role!,
        action: result.user.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
        details: { targetUserId: id, newStatus: result.user.isActive ? "active" : "inactive" },
      });

      return sendResponse(res, result, result.message);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to toggle user status";
      return sendError(res, message, message.includes("not found") ? 404 : 400);
    }
  }

  // ==================== USER ARCHIVING (SUPER_ADMIN, DOCTOR, VENDOR) ====================

  /**
   * DELETE /api/v1/users/:id
   * Archive (soft-delete) a user. Super Admin only. Cannot archive self.
   */
  async archiveUser(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;
      const role = req.user?.role;

      if (role !== "SUPER_ADMIN") {
        return sendError(res, "Only Super Admins can archive users", 403);
      }

      const result = await staffService.archiveUser(id, userId!);

      logActivity({
        req,
        userId: userId!,
        userRole: role!,
        action: "USER_ARCHIVED",
        details: { targetUserId: id },
      });

      return sendResponse(res, result, "User archived successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 400);
    }
  }

  /**
   * GET /api/v1/users/archived
   * Get all archived users. Super Admin only.
   */
  async getArchivedUsers(req: AuthRequest, res: Response) {
    try {
      const role = req.user?.role;

      if (role !== "SUPER_ADMIN") {
        return sendError(res, "Only Super Admins can view archived users", 403);
      }

      const { page, limit, search } = req.query;

      const result = await staffService.getArchivedUsers({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search as string,
      });

      return sendResponse(res, result, "Archived users fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * POST /api/v1/users/:id/restore
   * Restore an archived user. Super Admin only.
   */
  async restoreUser(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id;
      const role = req.user?.role;

      if (role !== "SUPER_ADMIN") {
        return sendError(res, "Only Super Admins can restore users", 403);
      }

      const result = await staffService.restoreUser(id);

      logActivity({
        req,
        userId: userId!,
        userRole: role!,
        action: "USER_RESTORED",
        details: { targetUserId: id },
      });

      return sendResponse(res, result, "User restored successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 400);
    }
  }

  // ==================== SELF-REGISTRATION APPROVALS ====================

  /**
   * GET /api/v1/users/pending-registrations
   * List doctors who self-registered and are awaiting approval
   */
  async getPendingRegistrations(_req: AuthRequest, res: Response) {
    try {
      const result = await staffService.getPendingRegistrations();
      return sendResponse(res, result, "Pending registrations fetched");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * POST /api/v1/users/:id/approve-registration
   * Approve a self-registered doctor (sets isActive=true, selfRegistered=false)
   */
  async approveRegistration(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const reviewerId = req.user!.id;
      const result = await staffService.approveRegistration(id, reviewerId);
      logActivity({
        req,
        userId: reviewerId,
        userRole: req.user!.role,
        action: "DOCTOR_REGISTRATION_APPROVED",
        details: { targetUserId: id },
      });
      return sendResponse(res, result, "Doctor registration approved");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 400);
    }
  }

  /**
   * POST /api/v1/users/:id/reject-registration
   * Reject a self-registered doctor (soft-deletes the account)
   */
  async rejectRegistration(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const reviewerId = req.user!.id;
      const result = await staffService.rejectRegistration(id, reviewerId);
      logActivity({
        req,
        userId: reviewerId,
        userRole: req.user!.role,
        action: "DOCTOR_REGISTRATION_REJECTED",
        details: { targetUserId: id },
      });
      return sendResponse(res, result, "Doctor registration rejected");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 400);
    }
  }
}

export const staffController = new StaffController();
