"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDiaryPages = exports.getAllDiaryPagesStaff = exports.getDiaryPageByNumber = exports.getAllDiaryPages = void 0;
const diaryPage_service_1 = require("../service/diaryPage.service");
const response_1 = require("../utils/response");
const constants_1 = require("../utils/constants");
/**
 * GET /api/v1/diary-pages
 * Get all diary pages with questions (for app to render manual entry)
 * Derives diaryType from the patient's caseType in JWT
 */
const getAllDiaryPages = async (req, res) => {
    try {
        const diaryType = (0, constants_1.getDiaryTypeForCaseType)(req.user?.caseType);
        const pages = await diaryPage_service_1.diaryPageService.getAllPages(diaryType);
        (0, response_1.sendResponse)(res, 200, "Diary pages retrieved successfully", pages);
    }
    catch (error) {
        console.error("Get diary pages error:", error);
        (0, response_1.sendError)(res, 500, error.message || "Failed to get diary pages");
    }
};
exports.getAllDiaryPages = getAllDiaryPages;
/**
 * GET /api/v1/diary-pages/:pageNumber
 * Get a single diary page by page number
 * Derives diaryType from the patient's caseType in JWT
 */
const getDiaryPageByNumber = async (req, res) => {
    try {
        const pageNumber = Number(req.params.pageNumber);
        if (isNaN(pageNumber)) {
            (0, response_1.sendError)(res, 400, "pageNumber must be a valid number");
            return;
        }
        const diaryType = (0, constants_1.getDiaryTypeForCaseType)(req.user?.caseType);
        const page = await diaryPage_service_1.diaryPageService.getPageByNumber(pageNumber, diaryType);
        (0, response_1.sendResponse)(res, 200, "Diary page retrieved successfully", page);
    }
    catch (error) {
        const status = error.message.includes("not found") ? 404 : 500;
        (0, response_1.sendError)(res, status, error.message);
    }
};
exports.getDiaryPageByNumber = getDiaryPageByNumber;
/**
 * GET /api/v1/diary-pages/staff/all
 * Get all diary pages (for doctor/assistant to view patient submissions)
 * Optional diaryType query param to filter; returns all if not provided
 */
const getAllDiaryPagesStaff = async (req, res) => {
    try {
        const diaryType = req.query.diaryType;
        const pages = await diaryPage_service_1.diaryPageService.getAllPages(diaryType);
        (0, response_1.sendResponse)(res, 200, "Diary pages retrieved successfully", pages);
    }
    catch (error) {
        console.error("Get diary pages (staff) error:", error);
        (0, response_1.sendError)(res, 500, error.message || "Failed to get diary pages");
    }
};
exports.getAllDiaryPagesStaff = getAllDiaryPagesStaff;
/**
 * POST /api/v1/diary-pages/seed
 * Seed all diary pages into the database (admin only)
 */
const seedDiaryPages = async (req, res) => {
    try {
        const count = await diaryPage_service_1.diaryPageService.seed();
        (0, response_1.sendResponse)(res, 201, `Seeded ${count} new diary pages`, { count });
    }
    catch (error) {
        console.error("Seed diary pages error:", error);
        (0, response_1.sendError)(res, 500, error.message || "Failed to seed diary pages");
    }
};
exports.seedDiaryPages = seedDiaryPages;
