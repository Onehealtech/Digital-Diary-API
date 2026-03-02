import { DiaryPage } from "../models/DiaryPage";
import { seedDiaryPages } from "../seeders/diaryPages.seed";

class DiaryPageService {
    /**
     * Get all active diary pages for a diary type, ordered by page number.
     * If diaryType is omitted, returns pages for all diary types.
     */
    async getAllPages(diaryType?: string) {
        const where: any = { isActive: true };
        if (diaryType) {
            where.diaryType = diaryType;
        }
        return DiaryPage.findAll({
            where,
            order: [["pageNumber", "ASC"]],
        });
    }

    /**
     * Get a single diary page by page number and diary type
     */
    async getPageByNumber(pageNumber: number, diaryType: string) {
        const page = await DiaryPage.findOne({
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
    async getPageById(id: string) {
        const page = await DiaryPage.findByPk(id);
        if (!page) throw new Error("Diary page not found");
        return page;
    }

    /**
     * Seed all diary pages into the database
     */
    async seed(): Promise<number> {
        return seedDiaryPages();
    }
}

export const diaryPageService = new DiaryPageService();
