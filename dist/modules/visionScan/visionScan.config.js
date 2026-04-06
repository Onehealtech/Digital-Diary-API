"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIME_TYPE_MAP = exports.VISION_SCAN_CONFIG = void 0;
exports.VISION_SCAN_CONFIG = {
    OPENROUTER_API_URL: "https://openrouter.ai/api/v1/chat/completions",
    // MODEL: "google/gemini-2.5-flash",
    // MODEL: "google/gemini-2.5-pro",
    MODEL: "anthropic/claude-opus-4-6",
    /** Must be large enough for the full JSON response.
     *  A page with 10 yes_no fields needs ~400 tokens; date/select fields need more.
     *  1024 handles pages with up to ~25 fields comfortably. */
    MAX_TOKENS: 2048,
    /** Temperature 0 = deterministic output. For structured data extraction,
     *  any randomness hurts accuracy. */
    TEMPERATURE: 0,
    LOW_CONFIDENCE_THRESHOLD: 0.8,
    HTTP_REFERER: "https://onehealtech.com",
    APP_TITLE: "CANTrac Diary Scan",
    S3_BUCKET: process.env.AWS_S3_BUCKET || "onheal-bucket",
    S3_REGION: process.env.AWS_REGION || "ap-south-1",
    S3_KEY_PREFIX: "diary-scans",
};
exports.MIME_TYPE_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
};
