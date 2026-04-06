"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireApprovedDiary = void 0;
const diaryAccess_service_1 = require("../service/diaryAccess.service");
const AppError_1 = require("../utils/AppError");
/**
 * Blocks patient diary APIs until Super Admin approves the sold diary.
 * Required because JWT auth alone cannot enforce business-level approval state.
 */
const requireApprovedDiary = async (req, res, next) => {
    try {
        const patientId = req.user?.id;
        if (!patientId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(patientId);
        next();
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({
                success: false,
                message: error.message || diaryAccess_service_1.DIARY_ACCESS_REQUIRED_MESSAGE,
            });
            return;
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("[DIARY_ACCESS] approval check failed:", message);
        res.status(500).json({ success: false, message: "Failed to validate diary approval" });
    }
};
exports.requireApprovedDiary = requireApprovedDiary;
