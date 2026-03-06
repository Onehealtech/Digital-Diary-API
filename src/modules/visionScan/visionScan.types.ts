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

export type PageDetectionResult =
    | { valid: true; pageNumber: number }
    | { valid: false; reason: string };
