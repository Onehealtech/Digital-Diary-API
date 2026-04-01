"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.visionScanUpload = exports.reportUpload = exports.notificationAttachmentUpload = exports.bubbleScanUpload = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uploadPath = path_1.default.join(__dirname, "../../uploads");
// Create folder if not exists
if (!fs_1.default.existsSync(uploadPath)) {
    fs_1.default.mkdirSync(uploadPath, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueName + path_1.default.extname(file.originalname));
    },
});
exports.upload = (0, multer_1.default)({ storage });
// Bubble scan specific upload (image-only, 10MB limit)
const bubbleScanPath = path_1.default.join(__dirname, "../../uploads/bubble_scans");
if (!fs_1.default.existsSync(bubbleScanPath)) {
    fs_1.default.mkdirSync(bubbleScanPath, { recursive: true });
}
const bubbleScanStorage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, bubbleScanPath);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueName + path_1.default.extname(file.originalname));
    },
});
exports.bubbleScanUpload = (0, multer_1.default)({
    storage: bubbleScanStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error("Only JPEG and PNG images are allowed"));
        }
    },
});
// Notification attachment upload (images + PDFs, 10MB)
const notificationAttachmentPath = path_1.default.join(__dirname, "../../uploads/notification_attachments");
if (!fs_1.default.existsSync(notificationAttachmentPath)) {
    fs_1.default.mkdirSync(notificationAttachmentPath, { recursive: true });
}
const notificationAttachmentStorage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, notificationAttachmentPath);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueName + path_1.default.extname(file.originalname));
    },
});
exports.notificationAttachmentUpload = (0, multer_1.default)({
    storage: notificationAttachmentStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf", "image/gif", "image/webp"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error("Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed"));
        }
    },
});
// Report upload — memory storage, supports PDF + DOC/DOCX + images, up to 25 MB each, max 5 files
const REPORT_ALLOWED_TYPES = [
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];
exports.reportUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (REPORT_ALLOWED_TYPES.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error("Only JPEG, PNG, WebP images, PDF, and DOC/DOCX files are allowed for reports"));
        }
    },
});
// Vision scan upload — memory storage (no local file, buffer goes to S3)
exports.visionScanUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error("Only JPEG and PNG images are allowed"));
        }
    },
});
