"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diaryPageService = void 0;
const DiaryPage_1 = require("../models/DiaryPage");
const diaryPages_seed_1 = require("../seeders/diaryPages.seed");
class DiaryPageService {
    /**
     * Get all active diary pages for a diary type, ordered by page number.
     * If diaryType is omitted, returns pages for all diary types.
     */
    async getAllPages(diaryType) {
        const where = { isActive: true };
        if (diaryType) {
            where.diaryType = diaryType;
        }
        return DiaryPage_1.DiaryPage.findAll({
            where,
            order: [["pageNumber", "ASC"]],
        });
    }
    /**
     * Get a single diary page by page number and diary type
     */
    async getPageByNumber(pageNumber, diaryType) {
        const page = await DiaryPage_1.DiaryPage.findOne({
            where: { pageNumber, diaryType, isActive: true },
        });
        if (!page) {
            throw new Error(`Diary page ${pageNumber} not found for ${diaryType}`);
        }
        return page;
    }
    /**
     * Get a diary page by its primary key (UUID)
     */
    async getPageById(id) {
        const page = await DiaryPage_1.DiaryPage.findByPk(id);
        if (!page)
            throw new Error("Diary page not found");
        return page;
    }
    /**
     * Seed all diary pages into the database
     */
    async seed() {
        return (0, diaryPages_seed_1.seedDiaryPages)();
    }
}
exports.diaryPageService = new DiaryPageService();
