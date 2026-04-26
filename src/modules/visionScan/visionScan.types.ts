export const ProcessingStatus = {
    PENDING: "pending",
    PROCESSING: "processing",
    COMPLETED: "completed",
    FAILED: "failed",
} as const;
export type ProcessingStatus =
    (typeof ProcessingStatus)[keyof typeof ProcessingStatus];

export const SubmissionType = {
    SCAN: "scan",
    MANUAL: "manual",
} as const;
export type SubmissionType =
    (typeof SubmissionType)[keyof typeof SubmissionType];

export interface OpenRouterResponse {
    choices?: Array<{
        message: { content: string };
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    error?: { message: string; code: number };
}

export interface DiaryQuestion {
    id: string;
    text: string;
    textHi?: string;
    type: "yes_no" | "date" | "select" | "text" | "info";
    category: string;
    options?: string[];
}

export interface AIFieldResult {
    value: string | null;
    confidence: number;
}

export interface AIExtractionResult {
    [questionId: string]: AIFieldResult;
}

export interface ProcessingMetadata {
    model: string;
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
    processingTimeMs: number;
    lowConfidenceFields: string[];
    // Scan analysis (rescan / rejection decision)
    action?:            "success" | "rescan_required" | "rejected";
    rescanRequired?:    boolean;
    rescanReasons?:     string[];
    rejectionRequired?: boolean;
    rejectionReasons?:  string[];
    dataError?:         string | null;
    alertMessage?:      string | null;
    userMessage?:       string;
    dataReliable?:      boolean;
    overallConfidence?: number;
    warnings?:          string[];
    // cantrac-omr enriched fields
    rescanTip?:          { english: string; hindi: string } | null;
    isValidCantracForm?: boolean;
    cantracFields?:      Record<string, { value: string | null; confidence: string }>;
    tokenUsage?:         {
        apiCalls: number; inputTokens: number; outputTokens: number;
        cacheWriteTokens: number; cacheReadTokens: number;
        totalTokens: number; estimatedCostUSD: number;
    };
    imageMetadata?:      {
        originalWidth: number; originalHeight: number; originalFormat: string;
        originalSize: number; processedWidth: number; processedHeight: number;
        processedSize: number; compressionRatio: string; wasPortrait: boolean;
    };
}

export interface EnrichedResult {
    answer: string | null;
    confidence: number;
    questionText: string;
    category: string;
}

export interface ScanFilterOptions {
    page?: number;
    limit?: number;
    processingStatus?: string;
    patientId?: string;
    startDate?: Date;
    endDate?: Date;
    reviewed?: boolean;
    flagged?: boolean;
}

export interface PaginatedResult<T> {
    scans: T[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface ReviewData {
    doctorNotes?: string;
    flagged?: boolean;
    overrides?: Record<string, string>;
}

export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export type PageDetectionResult =
    | { valid: true; pageNumber: number; usage: TokenUsage }
    | { valid: false; reason: string };
