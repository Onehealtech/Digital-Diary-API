import { Response } from "express";
import { staffService } from "../service/staff.service";
import { sendResponse, sendError } from "../utils/response";
import { AuthRequest } from "../middleware/authMiddleware";

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

  /**
   * GET /api/v1/doctors/:id
   * Get doctor by ID
   */
  async getDoctorById(req: AuthRequest, res: Response) {
    try {
      const id = req.params.id as string;
      const role = req.user?.role;

      if (role !== "SUPER_ADMIN") {
        return sendError(res, "Only Super Admins can view doctor details", 403);
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

      const result = await staffService.deleteAssistant(id);

      return sendResponse(res, result, "Assistant deleted successfully");
    } catch (error: any) {
      return sendError(res, error.message, error.message.includes("not found") ? 404 : 400);
    }
  }
}

export const staffController = new StaffController();
