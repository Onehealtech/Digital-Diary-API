import { Response } from "express";
import { AuthenticatedRequest, AuthRequest } from "../middleware/authMiddleware";
import { diaryPageService } from "../service/diaryPage.service";
import { sendResponse, sendError } from "../utils/response";
import { getDiaryTypeForCaseType } from "../utils/constants";

/**
 * GET /api/v1/diary-pages
 * Get all diary pages with questions (for app to render manual entry)
 * Derives diaryType from the patient's caseType in JWT
 */
export const getAllDiaryPages = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const diaryType = getDiaryTypeForCaseType(req.user?.caseType);
        const pages = await diaryPageService.getAllPages(diaryType);
        sendResponse(res, 200, "Diary pages retrieved successfully", pages);
    } catch (error: any) {
        console.error("Get diary pages error:", error);
        sendError(res, 500, error.message || "Failed to get diary pages");
    }
};

/**
 * GET /api/v1/diary-pages/:pageNumber
 * Get a single diary page by page number
 * Derives diaryType from the patient's caseType in JWT
 */
export const getDiaryPageByNumber = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const pageNumber = Number(req.params.pageNumber);
        if (isNaN(pageNumber)) {
            sendError(res, 400, "pageNumber must be a valid number");
            return;
        }
        const diaryType = getDiaryTypeForCaseType(req.user?.caseType);
        const page = await diaryPageService.getPageByNumber(pageNumber, diaryType);
        sendResponse(res, 200, "Diary page retrieved successfully", page);
    } catch (error: any) {
        const status = error.message.includes("not found") ? 404 : 500;
        sendError(res, status, error.message);
    }
};

/**
 * GET /api/v1/diary-pages/staff/all
 * Get all diary pages (for doctor/assistant to view patient submissions)
 * Optional diaryType query param to filter; returns all if not provided
 */
export const getAllDiaryPagesStaff = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const diaryType = req.query.diaryType as string | undefined;
        const pages = await diaryPageService.getAllPages(diaryType);
        sendResponse(res, 200, "Diary pages retrieved successfully", pages);
    } catch (error: any) {
        console.error("Get diary pages (staff) error:", error);
        sendError(res, 500, error.message || "Failed to get diary pages");
    }
};

/**
 * POST /api/v1/diary-pages/seed
 * Seed all diary pages into the database (admin only)
 */
export const seedDiaryPages = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const count = await diaryPageService.seed();
        sendResponse(res, 201, `Seeded ${count} new diary pages`, { count });
    } catch (error: any) {
        console.error("Seed diary pages error:", error);
        sendError(res, 500, error.message || "Failed to seed diary pages");
    }
};
