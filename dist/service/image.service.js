"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageService = void 0;
const ImageHistory_model_1 = __importDefault(require("../models/ImageHistory.model"));
const path_1 = __importDefault(require("path"));
class ImageService {
    static async uploadImage(diaryId, file, uploadSource, uploadedBy) {
        if (!file) {
            throw new Error("No file uploaded");
        }
        const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
        const image = await ImageHistory_model_1.default.create({
            diaryId,
            imagePath: baseUrl ? `${baseUrl}/uploads/${file.filename}` : `/uploads/${file.filename}`,
            // Keep the user-facing original name so doctors see something meaningful.
            fileName: path_1.default.basename(file.originalname || file.filename),
            uploadSource: uploadSource || "scan",
            uploadedBy: uploadedBy || "system",
        });
        return image;
    }
    static async getImageHistory(diaryId) {
        const images = await ImageHistory_model_1.default.findAll({
            where: { diaryId },
            order: [["createdAt", "ASC"]],
        });
        return images;
    }
}
exports.ImageService = ImageService;
