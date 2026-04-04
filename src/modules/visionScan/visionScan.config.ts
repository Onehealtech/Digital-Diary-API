export const VISION_SCAN_CONFIG = {
    OPENROUTER_API_URL: "https://openrouter.ai/api/v1/chat/completions",
    // MODEL: "google/gemini-2.5-flash",
    MODEL: "google/gemini-2.5-pro",
    /** Must be large enough for the full JSON response.
     *  Gemini 2.5 Pro is a thinking model — reasoning tokens consume from this budget.
     *  4096 ensures the model has enough room to think and produce the JSON output. */
    MAX_TOKENS: 4096,
    /** Temperature 0 = deterministic output. For structured data extraction,
     *  any randomness hurts accuracy. */
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
