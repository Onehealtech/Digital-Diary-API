"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImageHistory = exports.uploadImage = void 0;
const image_service_1 = require("../service/image.service");
const activityLogger_1 = require("../utils/activityLogger");
const uploadImage = async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({
                message: "No file uploaded",
            });
        }
        const uploadSource = req.body.uploadSource || "scan";
        const uploadedBy = req.body.uploadedBy || req.user?.id || "system";
        const image = await image_service_1.ImageService.uploadImage(id, req.file, uploadSource, uploadedBy);
        (0, activityLogger_1.logActivity)({
            req,
            userId: uploadedBy,
            userRole: req.user?.role || "PATIENT",
            action: "DIARY_IMAGE_ADDED",
            details: { diaryId: id, imageId: image.id, uploadSource, fileName: image.fileName },
        });
        return res.status(201).json({
            message: "Image uploaded successfully",
            data: image,
        });
    }
    catch (error) {
        return res.status(400).json({
            message: error.message,
        });
    }
};
exports.uploadImage = uploadImage;
const getImageHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const images = await image_service_1.ImageService.getImageHistory(id);
        return res.status(200).json({
            count: images.length,
            data: images,
        });
    }
    catch (error) {
        return res.status(500).json({
            message: error.message,
        });
    }
};
exports.getImageHistory = getImageHistory;
