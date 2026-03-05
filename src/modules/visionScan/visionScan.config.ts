export const VISION_SCAN_CONFIG = {
    OPENROUTER_API_URL: "https://openrouter.ai/api/v1/chat/completions",
    MODEL: "google/gemini-2.5-flash",
    MAX_TOKENS: 2048,
    TEMPERATURE: 0.1,
    LOW_CONFIDENCE_THRESHOLD: 0.8,
    HTTP_REFERER: "https://onehealtech.com",
    APP_TITLE: "CANTrac Diary Scan",
} as const;

export const MIME_TYPE_MAP: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
};
