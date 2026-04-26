"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildQuestionReportS3Key = exports.buildReportS3Key = exports.uploadBufferToS3 = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const path_1 = __importDefault(require("path"));
const s3Client = new client_s3_1.S3Client({
    region: process.env.AWS_REGION || "ap-south-1",
});
const S3_BUCKET = process.env.AWS_S3_BUCKET || "onheal-bucket";
const S3_REGION = process.env.AWS_REGION || "ap-south-1";
/**
 * Uploads a file buffer to S3 and returns the public HTTPS URL.
 *
 * @param buffer      File data
 * @param mimeType    e.g. "application/pdf" or "image/jpeg"
 * @param s3Key       Full S3 object key (path inside the bucket)
 */
async function uploadBufferToS3(buffer, mimeType, s3Key) {
    await s3Client.send(new client_s3_1.PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: mimeType,
    }));
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${s3Key}`;
}
exports.uploadBufferToS3 = uploadBufferToS3;
const MIME_EXT_MAP = {
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
};
/**
 * Builds an S3 key for a patient report file.
 * Pattern: patient-reports/{patientId}/{scanId}/{timestamp}-{random}.{ext}
 */
function buildReportS3Key(patientId, scanId, originalname, mimeType) {
    const ext = path_1.default.extname(originalname).toLowerCase() ||
        MIME_EXT_MAP[mimeType] ||
        `.${mimeType.split("/")[1] ?? "bin"}`;
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `patient-reports/${patientId}/${scanId}/${unique}${ext}`;
}
exports.buildReportS3Key = buildReportS3Key;
/**
 * Builds an S3 key for a question-specific report file.
 * Pattern: patient-reports/{patientId}/{scanId}/questions/{questionId}/{timestamp}-{random}.{ext}
 */
function buildQuestionReportS3Key(patientId, scanId, questionId, originalname, mimeType) {
    const ext = path_1.default.extname(originalname).toLowerCase() ||
        MIME_EXT_MAP[mimeType] ||
        `.${mimeType.split("/")[1] ?? "bin"}`;
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `patient-reports/${patientId}/${scanId}/questions/${questionId}/${unique}${ext}`;
}
exports.buildQuestionReportS3Key = buildQuestionReportS3Key;
