export const VISION_SCAN_CONFIG = {
    /** Python OMR microservice URL (handles bubble detection + AI fallback) */
    VISION_PROCESSOR_URL: process.env.VISION_PROCESSOR_URL || "http://localhost:8001",

    /** OpenRouter config — used by Python service for AI fallback + legacy page detection */
    OPENROUTER_API_URL: "https://openrouter.ai/api/v1/chat/completions",
    MODEL: "google/gemini-2.5-flash",
    MAX_TOKENS: 2048,
    TEMPERATURE: 0,

    LOW_CONFIDENCE_THRESHOLD: 0.8,
    HTTP_REFERER: "https://onehealtech.com",
    APP_TITLE: "CANTrac Diary Scan",
    S3_BUCKET: process.env.AWS_S3_BUCKET || "onheal-bucket",
    S3_REGION: process.env.AWS_REGION || "ap-south-1",
    S3_KEY_PREFIX: "diary-scans",
} as const;

export const MIME_TYPE_MAP: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
};
