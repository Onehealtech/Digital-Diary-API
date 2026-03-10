"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiaryController = void 0;
const diary_service_1 = require("../service/diary.service");
const response_1 = require("../utils/response");
const diaryService = new diary_service_1.DiaryService();
class DiaryController {
    /**
     * POST /api/generated-diaries/generate - Generate diaries
     */
    async generateDiaries(req, res) {
        try {
            const { quantity, diaryType } = req.body;
            if (!quantity) {
                return (0, response_1.sendError)(res, 400, "Quantity is required");
            }
            const ENABLED_DIARY_TYPES = ["peri-operative"];
            if (diaryType && !ENABLED_DIARY_TYPES.includes(diaryType)) {
                return (0, response_1.sendError)(res, 400, `Diary type "${diaryType}" is coming soon and not yet available. Only Peri-Operative diaries can be generated at this time.`);
            }
            const result = await diaryService.generateDiaries(quantity, diaryType);
            return (0, response_1.sendResponse)(res, 201, "Diaries generated successfully", result);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to generate diaries", error.message);
        }
    }
    /**
     * GET /api/generated-diaries - List all generated diaries
     */
    async getAllGeneratedDiaries(req, res) {
        try {
            const { page, limit, status, vendorId, search } = req.query;
            const result = await diaryService.getAllGeneratedDiaries({
                page: page ? parseInt(page) : undefined,
                limit: limit ? parseInt(limit) : undefined,
                status: status,
                vendorId: vendorId,
                search: search,
            });
            return (0, response_1.sendResponse)(res, 200, "Diaries retrieved successfully", result);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to retrieve diaries", error.message);
        }
    }
    /**
     * GET /api/generated-diaries/:id - Get diary by ID
     */
    async getDiaryById(req, res) {
        try {
            const id = req.params.id;
            const diary = await diaryService.getDiaryById(id);
            return (0, response_1.sendResponse)(res, 200, "Diary retrieved successfully", diary);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 404, error.message);
        }
    }
    /**
     * PUT /api/generated-diaries/:id/assign - Assign diary to vendor
     */
    async assignDiary(req, res) {
        try {
            const id = req.params.id;
            const { vendorId } = req.body;
            if (!vendorId) {
                return (0, response_1.sendError)(res, 400, "Vendor ID is required");
            }
            const diary = await diaryService.assignDiaryToVendor(id, vendorId);
            return (0, response_1.sendResponse)(res, 200, "Diary assigned successfully", diary);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to assign diary", error.message);
        }
    }
    /**
     * PUT /api/generated-diaries/bulk-assign - Bulk assign diaries
     */
    async bulkAssignDiaries(req, res) {
        try {
            const { diaryIds, vendorId } = req.body;
            if (!diaryIds || !vendorId) {
                return (0, response_1.sendError)(res, 400, "Diary IDs and Vendor ID are required");
            }
            const result = await diaryService.bulkAssignDiaries(diaryIds, vendorId);
            return (0, response_1.sendResponse)(res, 200, "Diaries assigned successfully", result);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to assign diaries", error.message);
        }
    }
    /**
     * PUT /api/generated-diaries/:id/unassign - Unassign diary
     */
    async unassignDiary(req, res) {
        try {
            const id = req.params.id;
            const diary = await diaryService.unassignDiary(id);
            return (0, response_1.sendResponse)(res, 200, "Diary unassigned successfully", diary);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to unassign diary", error.message);
        }
    }
    async getAllSoldDiaries(req, res) {
        try {
            const { page, limit } = req.query;
            const result = await diaryService.getAllSoldDiaries({
                page: page ? parseInt(page) : undefined,
                limit: limit ? parseInt(limit) : undefined,
            });
            return (0, response_1.sendResponse)(res, 200, "Sold diaries retrieved successfully", result);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to retrieve sold diaries", error.message);
        }
    }
    /**
     * PUT /api/diaries/:id/approve - Approve diary sale
     */
    async approveDiarySale(req, res) {
        try {
            const id = req.params.id;
            const superAdminId = req.user.id;
            const diary = await diaryService.approveDiarySale(id, superAdminId);
            return (0, response_1.sendResponse)(res, 200, "Diary sale approved successfully", diary);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to approve diary sale", error.message);
        }
    }
    /**
     * PUT /api/diaries/:id/reject - Reject diary sale
     */
    async rejectDiarySale(req, res) {
        try {
            const id = req.params.id;
            const { reason } = req.body;
            const superAdminId = req.user.id;
            if (!reason) {
                return (0, response_1.sendError)(res, 400, "Rejection reason is required");
            }
            const diary = await diaryService.rejectDiarySale(id, superAdminId, reason);
            return (0, response_1.sendResponse)(res, 200, "Diary sale rejected", diary);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to reject diary sale", error.message);
        }
    }
    /**
     * GET /api/diary-requests - List diary requests
     */
    async getAllDiaryRequests(req, res) {
        try {
            const { page, limit, status } = req.query;
            const vendorId = req.user?.role === "VENDOR" ? req.user.id : undefined;
            const result = await diaryService.getAllDiaryRequests({
                page: page ? parseInt(page) : undefined,
                limit: limit ? parseInt(limit) : undefined,
                vendorId: vendorId,
                status: status,
            });
            return (0, response_1.sendResponse)(res, 200, "Diary requests retrieved successfully", result);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to retrieve diary requests", error.message);
        }
    }
    async getAllDiaryRequestsSuperAdmin(req, res) {
        try {
            const { page, limit, status } = req.query;
            const result = await diaryService.getALLDiaryRequestSuperAdmin({
                page: page ? parseInt(page) : undefined,
                limit: limit ? parseInt(limit) : undefined,
                status: status,
            });
            return (0, response_1.sendResponse)(res, 200, "Diary requests retrieved successfully", result);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to retrieve diary requests", error.message);
        }
    }
    /**
     * POST /api/diary-requests - Create diary request
     */
    async createDiaryRequest(req, res) {
        try {
            const { quantity, message, dairyType } = req.body;
            const vendorId = req.user.id;
            if (!quantity) {
                return (0, response_1.sendError)(res, 400, "Quantity is required");
            }
            const request = await diaryService.createDiaryRequest(vendorId, quantity, message, dairyType);
            return (0, response_1.sendResponse)(res, 201, "Diary request created successfully", request);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to create diary request", error.message);
        }
    }
    /**
     * PUT /api/diary-requests/:id/approve - Approve diary request
     */
    async approveDiaryRequest(req, res) {
        try {
            const id = req.params.id;
            const superAdminId = req.user.id;
            const request = await diaryService.approveDiaryRequest(id, superAdminId);
            return (0, response_1.sendResponse)(res, 200, "Diary request approved successfully", request);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to approve diary request", error.message);
        }
    }
    /**
     * PUT /api/diary-requests/:id/reject - Reject diary request
     */
    async rejectDiaryRequest(req, res) {
        try {
            const id = req.params.id;
            const { reason } = req.body;
            const superAdminId = req.user.id;
            if (!reason) {
                return (0, response_1.sendError)(res, 400, "Rejection reason is required");
            }
            const request = await diaryService.rejectDiaryRequest(id, superAdminId, reason);
            return (0, response_1.sendResponse)(res, 200, "Diary request rejected", request);
        }
        catch (error) {
            return (0, response_1.sendError)(res, 500, "Failed to reject diary request", error.message);
        }
    }
}
exports.DiaryController = DiaryController;
