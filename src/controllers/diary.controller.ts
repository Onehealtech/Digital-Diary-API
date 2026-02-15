import { Request, Response } from "express";
import { DiaryService } from "../service/diary.service";
import { sendResponse, sendError } from "../utils/response";

const diaryService = new DiaryService();

export class DiaryController {
  /**
   * POST /api/generated-diaries/generate - Generate diaries
   */
  async generateDiaries(req: Request, res: Response) {
    try {
      const { quantity, diaryType } = req.body;

      if (!quantity) {
        return sendError(res, 400, "Quantity is required");
      }

      const result = await diaryService.generateDiaries(quantity, diaryType);

      return sendResponse(res, 201, "Diaries generated successfully", result);
    } catch (error: any) {
      return sendError(res, 500, "Failed to generate diaries", error.message);
    }
  }

  /**
   * GET /api/generated-diaries - List all generated diaries
   */
  async getAllGeneratedDiaries(req: Request, res: Response) {
    try {
      const { page, limit, status, vendorId, search } = req.query;

      const result = await diaryService.getAllGeneratedDiaries({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as string,
        vendorId: vendorId as string,
        search: search as string,
      });

      return sendResponse(res, 200, "Diaries retrieved successfully", result);
    } catch (error: any) {
      return sendError(res, 500, "Failed to retrieve diaries", error.message);
    }
  }

  /**
   * GET /api/generated-diaries/:id - Get diary by ID
   */
  async getDiaryById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const diary = await diaryService.getDiaryById(id);

      return sendResponse(res, 200, "Diary retrieved successfully", diary);
    } catch (error: any) {
      return sendError(res, 404, error.message);
    }
  }

  /**
   * PUT /api/generated-diaries/:id/assign - Assign diary to vendor
   */
  async assignDiary(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { vendorId } = req.body;

      if (!vendorId) {
        return sendError(res, 400, "Vendor ID is required");
      }

      const diary = await diaryService.assignDiaryToVendor(id, vendorId);

      return sendResponse(res, 200, "Diary assigned successfully", diary);
    } catch (error: any) {
      return sendError(res, 500, "Failed to assign diary", error.message);
    }
  }

  /**
   * PUT /api/generated-diaries/bulk-assign - Bulk assign diaries
   */
  async bulkAssignDiaries(req: Request, res: Response) {
    try {
      const { diaryIds, vendorId } = req.body;

      if (!diaryIds || !vendorId) {
        return sendError(res, 400, "Diary IDs and Vendor ID are required");
      }

      const result = await diaryService.bulkAssignDiaries(diaryIds, vendorId);

      return sendResponse(res, 200, "Diaries assigned successfully", result);
    } catch (error: any) {
      return sendError(res, 500, "Failed to assign diaries", error.message);
    }
  }

  /**
   * PUT /api/generated-diaries/:id/unassign - Unassign diary
   */
  async unassignDiary(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const diary = await diaryService.unassignDiary(id);

      return sendResponse(res, 200, "Diary unassigned successfully", diary);
    } catch (error: any) {
      return sendError(res, 500, "Failed to unassign diary", error.message);
    }
  }

  /**
   * PUT /api/diaries/:id/approve - Approve diary sale
   */
  async approveDiarySale(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const superAdminId = (req as any).user.id;

      const diary = await diaryService.approveDiarySale(id, superAdminId);

      return sendResponse(res, 200, "Diary sale approved successfully", diary);
    } catch (error: any) {
      return sendError(res, 500, "Failed to approve diary sale", error.message);
    }
  }

  /**
   * PUT /api/diaries/:id/reject - Reject diary sale
   */
  async rejectDiarySale(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { reason } = req.body;
      const superAdminId = (req as any).user.id;

      if (!reason) {
        return sendError(res, 400, "Rejection reason is required");
      }

      const diary = await diaryService.rejectDiarySale(id, superAdminId, reason);

      return sendResponse(res, 200, "Diary sale rejected", diary);
    } catch (error: any) {
      return sendError(res, 500, "Failed to reject diary sale", error.message);
    }
  }

  /**
   * GET /api/diary-requests - List diary requests
   */
  async getAllDiaryRequests(req: Request, res: Response) {
    try {
      const { page, limit, vendorId, status } = req.query;

      const result = await diaryService.getAllDiaryRequests({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        vendorId: vendorId as string,
        status: status as string,
      });

      return sendResponse(res, 200, "Diary requests retrieved successfully", result);
    } catch (error: any) {
      return sendError(res, 500, "Failed to retrieve diary requests", error.message);
    }
  }

  /**
   * POST /api/diary-requests - Create diary request
   */
  async createDiaryRequest(req: Request, res: Response) {
    try {
      const { quantity, message } = req.body;
      const vendorId = (req as any).user.id;

      if (!quantity) {
        return sendError(res, 400, "Quantity is required");
      }

      const request = await diaryService.createDiaryRequest(vendorId, quantity, message);

      return sendResponse(res, 201, "Diary request created successfully", request);
    } catch (error: any) {
      return sendError(res, 500, "Failed to create diary request", error.message);
    }
  }

  /**
   * PUT /api/diary-requests/:id/approve - Approve diary request
   */
  async approveDiaryRequest(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const superAdminId = (req as any).user.id;

      const request = await diaryService.approveDiaryRequest(id, superAdminId);

      return sendResponse(res, 200, "Diary request approved successfully", request);
    } catch (error: any) {
      return sendError(res, 500, "Failed to approve diary request", error.message);
    }
  }

  /**
   * PUT /api/diary-requests/:id/reject - Reject diary request
   */
  async rejectDiaryRequest(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { reason } = req.body;
      const superAdminId = (req as any).user.id;

      if (!reason) {
        return sendError(res, 400, "Rejection reason is required");
      }

      const request = await diaryService.rejectDiaryRequest(id, superAdminId, reason);

      return sendResponse(res, 200, "Diary request rejected", request);
    } catch (error: any) {
      return sendError(res, 500, "Failed to reject diary request", error.message);
    }
  }
}
