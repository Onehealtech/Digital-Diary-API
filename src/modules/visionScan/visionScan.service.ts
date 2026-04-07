import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import axios from "axios";
import FormData from "form-data";
import { BubbleScanResult } from "../../models/BubbleScanResult";
import { getDiaryTypeForCaseType } from "../../utils/constants";
import { AppError } from "../../utils/AppError";
import { visionScanRepository } from "./visionScan.repository";
import { buildExtractionPrompt, VISION_SCAN_SYSTEM_PROMPT, PAGE_DETECTION_PROMPT } from "./visionScan.prompts";
import { VISION_SCAN_CONFIG } from "./visionScan.config";
import {
    AIExtractionResult,
    DiaryQuestion,
    EnrichedResult,
    OpenRouterResponse,
    PageDetectionResult,
    ProcessingMetadata,
    ProcessingStatus,
    ReviewData,
    ScanFilterOptions,
    SubmissionType,
} from "./visionScan.types";

class VisionScanService {
    private apiKey: string;
    private s3Client: S3Client;

    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY || "";
        if (!this.apiKey) {
            console.warn(
                "[VisionScan] OPENROUTER_API_KEY not set in .env — scan processing will fail"
            );
        }
        this.s3Client = new S3Client({ region: VISION_SCAN_CONFIG.S3_REGION });
    }

    private async uploadToS3(
        buffer: Buffer,
        mimeType: string,
        patientId: string,
        diaryType: string,
        pageNumber: number
    ): Promise<string> {
        const ext = mimeType === "image/png" ? "png" : "jpg";
        const key = `${VISION_SCAN_CONFIG.S3_KEY_PREFIX}/${patientId}/${diaryType}/page-${pageNumber}/${Date.now()}.${ext}`;

        await this.s3Client.send(
            new PutObjectCommand({
                Bucket: VISION_SCAN_CONFIG.S3_BUCKET,
                Key: key,
                Body: buffer,
                ContentType: mimeType,
            })
        );

        return `https://${VISION_SCAN_CONFIG.S3_BUCKET}.s3.${VISION_SCAN_CONFIG.S3_REGION}.amazonaws.com/${key}`;
    }

    private async detectPageNumber(
        base64: string,
        mimeType: string
    ): Promise<PageDetectionResult> {

        const body = {
            model: VISION_SCAN_CONFIG.MODEL,
            messages: [
                {
                    role: "system",
                    content: VISION_SCAN_SYSTEM_PROMPT,
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: PAGE_DETECTION_PROMPT },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64}`,
                            },
                        },
                    ],
                },
            ],
            temperature: 0,
            max_tokens: VISION_SCAN_CONFIG.MAX_TOKENS,
        };

        const response = await fetch(VISION_SCAN_CONFIG.OPENROUTER_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
                "HTTP-Referer": VISION_SCAN_CONFIG.HTTP_REFERER,
                "X-Title": VISION_SCAN_CONFIG.APP_TITLE,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new AppError(502, `Page detection API error (${response.status}): ${errorText}`);
        }

        const data = (await response.json()) as OpenRouterResponse;
        console.log("[PageDetection] API response:", JSON.stringify(data, null, 2));
        if (data.error) {
            throw new AppError(502, `Page detection error: ${data.error.message}`);
        }

        let rawText = data.choices?.[0]?.message?.content?.trim() || "";
        const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        if (rawText.startsWith("```")) {
            rawText = rawText
                .replace(/^```(?:json)?\n?/, "")
                .replace(/\n?```$/, "");
        }

        let parsed: { isValidDiaryPage: boolean; pageNumber?: number; reason?: string };
        try {
            parsed = JSON.parse(rawText);
        } catch {
            throw new AppError(500, `Failed to parse page detection response: ${rawText}`);
        }

        if (!parsed.isValidDiaryPage) {
            return {
                valid: false,
                reason: `Invalid image: This does not appear to be a CANTrac diary page. ${parsed.reason || ""}`,
            };
        }

        if (!parsed.pageNumber || typeof parsed.pageNumber !== "number") {
            return {
                valid: false,
                reason: `Could not detect page number from the diary page image.`,
            };
        }

        return { valid: true, pageNumber: parsed.pageNumber, usage };
    }

    /**
     * Process scan: detect page, validate, upsert record, run extraction, return completed result.
     * - If the same page was scanned before, updates the existing record and increments scanCount.
     * - Replaces null answers with "not answered" in the final results.
     * - Returns an error immediately if the page/QR cannot be detected.
     */
    async processScan(
        patientId: string,
        pageNumber: number | undefined,
        imageBuffer: Buffer,
        mimeType: string,
        diaryType: string
    ): Promise<BubbleScanResult | { valid: false; reason: string }> {
        const base64 = imageBuffer.toString("base64");
        let detectedPageNumber: number;

        if (pageNumber) {
            detectedPageNumber = pageNumber;
        } else {
            // Page detection — return error immediately if image is not a valid diary page
            const detection = await this.detectPageNumber(base64, mimeType);
            if (!detection.valid) {
                return {
                    valid: false,
                    reason: detection.reason || "Unable to detect page number or QR code. Please take a clear photo of the diary page.",
                };
            }
            detectedPageNumber = detection.pageNumber;
        }

        // Validate detected page number is reasonable
        if (!detectedPageNumber || detectedPageNumber < 1 || detectedPageNumber > 50) {
            return {
                valid: false,
                reason: `Invalid page number detected (${detectedPageNumber}). Please ensure the page number and QR code are clearly visible.`,
            };
        }

        // Run DB lookup and S3 upload in parallel
        const [diaryPage, s3Url] = await Promise.all([
            visionScanRepository.findDiaryPage(detectedPageNumber, diaryType),
            this.uploadToS3(imageBuffer, mimeType, patientId, diaryType, detectedPageNumber),
        ]);
        if (!diaryPage) {
            throw new AppError(
                404,
                `Diary page ${detectedPageNumber} not found for diary type "${diaryType}"`
            );
        }

        // Upsert: update existing record if same page was scanned before, else create new
        const { record: scanRecord, isRescan } = await visionScanRepository.upsertScanRecord({
            patientId,
            pageNumber: detectedPageNumber,
            diaryPageId: diaryPage.id,
            submissionType: SubmissionType.SCAN,
            processingStatus: ProcessingStatus.PROCESSING,
            imageUrl: s3Url,
        });

        if (isRescan) {
            console.log(`[VisionScan] Re-scan detected for patient ${patientId}, page ${detectedPageNumber} (scan #${scanRecord.scanCount})`);
        }

        const jobData = {
            scanRecordId: scanRecord.id,
            base64,
            mimeType,
            diaryType,
            detectedPageNumber,
            patientId,
        };

        // Run extraction synchronously so the response includes scanResults
        try {
            await this.processExtraction(jobData);
        } catch (err: any) {
            console.error("[VisionScan] Extraction failed:", err.message);
        }

        // Reload to get the completed data (with scanResults populated)
        const completedRecord = await visionScanRepository.findScanById(scanRecord.id);
        return completedRecord || scanRecord;
    }

    /**
     * Background worker: runs extraction via Python OMR microservice (OpenCV + Gemini Flash fallback).
     * Falls back to legacy full-AI extraction if the Python service is unavailable.
     */
    async processExtraction(data: {
        scanRecordId: string;
        base64: string;
        mimeType: string;
        diaryType: string;
        detectedPageNumber: number;
        patientId: string;
    }): Promise<Record<string, EnrichedResult> | null> {
        const scanRecord = await visionScanRepository.findScanById(data.scanRecordId);
        if (!scanRecord) {
            console.error(`[VisionScan] Scan record ${data.scanRecordId} not found, skipping extraction`);
            return null;
        }

        const diaryPage = await visionScanRepository.findDiaryPage(
            data.detectedPageNumber,
            data.diaryType
        );
        if (!diaryPage) {
            await visionScanRepository.updateScanFailed(
                scanRecord,
                `Diary page ${data.detectedPageNumber} not found for "${data.diaryType}"`
            );
            return null;
        }

        try {
            const startTime = Date.now();
            let enrichedResults: Record<string, EnrichedResult>;
            let rawConfidenceScores: Record<string, number> = {};
            let lowConfidenceFields: string[] = [];
            let modelUsed = "hybrid-omr";

            // Try Python OMR microservice first
            try {
                const omrResult = await this.callOMRService(data.base64, data.mimeType, diaryPage);
                enrichedResults = omrResult.extraction;
                rawConfidenceScores = {};
                lowConfidenceFields = [];

                for (const [qid, result] of Object.entries(enrichedResults)) {
                    rawConfidenceScores[qid] = result.confidence;
                    if (result.confidence < VISION_SCAN_CONFIG.LOW_CONFIDENCE_THRESHOLD) {
                        lowConfidenceFields.push(`${qid}: ${result.questionText} (${result.confidence})`);
                    }
                }

                modelUsed = `hybrid-omr+${VISION_SCAN_CONFIG.MODEL}`;
                console.log(`[VisionScan] OMR service: ${omrResult.metadata.omrAnswered} OMR + ${omrResult.metadata.aiAnswered} AI of ${omrResult.metadata.totalFields} fields`);
            } catch (omrError: any) {
                // Python service unavailable or failed — fall back to legacy full-AI extraction
                console.warn(`[VisionScan] OMR service failed: ${omrError.message}${omrError.cause ? ` | cause: ${omrError.cause}` : ""}`);
                console.warn(`[VisionScan] Falling back to full AI extraction`);
                const prompt = buildExtractionPrompt(diaryPage);
                const aiResult = await this.callVisionApi(data.base64, data.mimeType, prompt);

                const built = this.buildEnrichedResults(diaryPage.questions, aiResult.extraction);
                enrichedResults = built.enrichedResults;
                rawConfidenceScores = built.rawConfidenceScores;
                lowConfidenceFields = built.lowConfidenceFields;
                modelUsed = VISION_SCAN_CONFIG.MODEL;
            }

            const processingTimeMs = Date.now() - startTime;

            // Replace null answers with "not answered"
            for (const [qid, result] of Object.entries(enrichedResults)) {
                if (result.answer === null || result.answer === undefined) {
                    enrichedResults[qid] = { ...result, answer: "not answered" };
                }
            }

            const metadata: ProcessingMetadata = {
                model: modelUsed,
                promptTokens: 0,
                responseTokens: 0,
                totalTokens: 0,
                processingTimeMs,
                lowConfidenceFields,
            };

            await Promise.all([
                visionScanRepository.updateScanCompleted(scanRecord, {
                    scanResults: enrichedResults,
                    rawConfidenceScores,
                    processingMetadata: metadata,
                    flagged: lowConfidenceFields.length > 0,
                }),
                visionScanRepository.syncToScanLog(
                    data.patientId,
                    data.detectedPageNumber,
                    enrichedResults
                ),
            ]);

            return enrichedResults;
        } catch (error: any) {
            await visionScanRepository.updateScanFailed(
                scanRecord,
                error.message || "Unexpected processing error"
            );
            throw error; // Re-throw so BullMQ can retry
        }
    }

    /**
     * Call the Python OMR microservice (OpenCV bubble detection + Gemini Flash AI fallback).
     */
    private async callOMRService(
        base64: string,
        mimeType: string,
        diaryPage: { title: string; questions: any[] }
    ): Promise<{
        extraction: Record<string, EnrichedResult>;
        metadata: { totalFields: number; omrAnswered: number; aiAnswered: number; processingTimeMs: number };
    }> {
        const imageBuffer = Buffer.from(base64, "base64");
        const ext = mimeType.includes("png") ? "png" : "jpg";

        const form = new FormData();
        form.append("image", imageBuffer, { filename: `page.${ext}`, contentType: mimeType });
        form.append("questions", JSON.stringify(diaryPage.questions));
        form.append("page_title", diaryPage.title || "");

        const url = `${VISION_SCAN_CONFIG.VISION_PROCESSOR_URL}/process-scan`;

        const response = await axios.post(url, form, {
            headers: form.getHeaders(),
            timeout: 300_000, // 5 min — dual model extraction can take time
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });

        const result = response.data;

        if (!result.success) {
            throw new AppError(502, `OMR processing failed: ${result.error || result.message}`);
        }

        return {
            extraction: result.extraction,
            metadata: result.metadata,
        };
    }

    async manualSubmit(
        patientId: string,
        pageNumber: number,
        answers: Record<string, string>,
        diaryType: string
    ): Promise<BubbleScanResult> {
        const diaryPage = await visionScanRepository.findDiaryPage(
            pageNumber,
            diaryType
        );
        console.log(diaryPage,"diaryPage");
        
        if (!diaryPage) {
            throw new AppError(404, `Diary page ${pageNumber} not found for ${diaryType}`);
        }

        const enrichedResults: Record<string, EnrichedResult> = {};
        for (const [qId, answer] of Object.entries(answers)) {
            const questionDef = diaryPage.questions.find((q) => q.id === qId);
            enrichedResults[qId] = {
                answer,
                confidence: 1.0,
                questionText: questionDef?.text || "Unknown question",
                category: questionDef?.category || "uncategorized",
            };
        }
        console.log(enrichedResults,"enrichedResults");
        
        const { record } = await visionScanRepository.upsertScanRecord({
            patientId,
            pageNumber,
            diaryPageId: diaryPage.id,
            submissionType: SubmissionType.MANUAL,
            processingStatus: ProcessingStatus.COMPLETED,
            scanResults: enrichedResults,
        });
        console.log(`Manual submission saved for patient ${patientId}, page ${pageNumber}`);
        console.log(record,"record");
        await visionScanRepository.syncToScanLog(
            patientId,
            pageNumber,
            enrichedResults
        );

        return record;
    }

    async retryScan(scanId: string): Promise<BubbleScanResult> {
        const existing = await visionScanRepository.findScanById(scanId);
        if (!existing) throw new AppError(404, "Scan not found");
        if (existing.processingStatus !== ProcessingStatus.FAILED) {
            throw new AppError(400, "Can only retry failed scans");
        }

        const caseType = await visionScanRepository.findPatientCaseType(
            existing.patientId
        );
        const diaryType = getDiaryTypeForCaseType(caseType);

        const { patientId, pageNumber, imageUrl } = existing;
        if (!pageNumber || !imageUrl) {
            throw new AppError(400, "Missing pageNumber or imageUrl on failed scan");
        }

        // Download image from S3, reset status, and re-queue extraction
        const { buffer, mimeType } = await this.downloadFromS3(imageUrl);
        const base64 = buffer.toString("base64");

        await existing.update({ processingStatus: ProcessingStatus.PROCESSING, errorMessage: null });

        const { visionScanQueue } = require("./visionScan.queue");
        await visionScanQueue.add("extract", {
            scanRecordId: existing.id,
            base64,
            mimeType,
            diaryType,
            detectedPageNumber: pageNumber,
            patientId,
        });

        return existing;
    }

    private async downloadFromS3(
        s3Url: string
    ): Promise<{ buffer: Buffer; mimeType: string }> {
        // Extract key from S3 URL
        const url = new URL(s3Url);
        const key = url.pathname.slice(1); // remove leading /

        const response = await this.s3Client.send(
            new GetObjectCommand({
                Bucket: VISION_SCAN_CONFIG.S3_BUCKET,
                Key: key,
            })
        );

        const bodyBytes = await response.Body?.transformToByteArray();
        if (!bodyBytes) throw new AppError(500, "Empty response from S3");

        return {
            buffer: Buffer.from(bodyBytes),
            mimeType: response.ContentType || "image/jpeg",
        };
    }

    async getPatientScanHistory(patientId: string, page = 1, limit = 20) {
        return visionScanRepository.getPatientScans(patientId, page, limit);
    }

    async getScanById(scanId: string) {
        const scan = await visionScanRepository.findScanByIdWithPatient(scanId);
        if (!scan) throw new AppError(404, "Bubble scan result not found");
        return scan;
    }

    async reviewScan(scanId: string, doctorId: string, data: ReviewData) {
        const scan = await visionScanRepository.findScanById(scanId);
        if (!scan) throw new AppError(404, "Bubble scan result not found");
        return visionScanRepository.updateScanReview(scan, doctorId, data);
    }

    async getAllScans(
        doctorId: string,
        role: string,
        filters: ScanFilterOptions = {}
    ) {
        return visionScanRepository.getDoctorPatientScans(
            doctorId,
            role,
            filters
        );
    }

    private buildEnrichedResults(
        questions: DiaryQuestion[],
        extraction: AIExtractionResult
    ): {
        enrichedResults: Record<string, EnrichedResult>;
        rawConfidenceScores: Record<string, number>;
        lowConfidenceFields: string[];
    } {
        const enrichedResults: Record<string, EnrichedResult> = {};
        const rawConfidenceScores: Record<string, number> = {};
        const lowConfidenceFields: string[] = [];

        for (const question of questions) {
            if (question.type === "info") continue;

            const aiField = extraction[question.id];
            if (aiField) {
                enrichedResults[question.id] = {
                    answer: aiField.value,
                    confidence: aiField.confidence,
                    questionText: question.text,
                    category: question.category,
                };
                rawConfidenceScores[question.id] = aiField.confidence;

                if (
                    aiField.confidence <
                    VISION_SCAN_CONFIG.LOW_CONFIDENCE_THRESHOLD
                ) {
                    lowConfidenceFields.push(
                        `${question.id}: ${question.text} (${aiField.confidence})`
                    );
                }
            } else {
                enrichedResults[question.id] = {
                    answer: null,
                    confidence: 0,
                    questionText: question.text,
                    category: question.category,
                };
                lowConfidenceFields.push(
                    `${question.id}: ${question.text} (missing from AI response)`
                );
            }
        }

        return { enrichedResults, rawConfidenceScores, lowConfidenceFields };
    }

    private async callVisionApi(
        base64: string,
        mimeType: string,
        prompt: string
    ): Promise<{
        extraction: AIExtractionResult;
        usage: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
        };
    }> {

        const body = {
            model: VISION_SCAN_CONFIG.MODEL,
            messages: [
                {
                    role: "system",
                    content: VISION_SCAN_SYSTEM_PROMPT,
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64}`,
                            },
                        },
                    ],
                },
            ],
            temperature: VISION_SCAN_CONFIG.TEMPERATURE,
            max_tokens: VISION_SCAN_CONFIG.MAX_TOKENS,
        };

        const response = await fetch(VISION_SCAN_CONFIG.OPENROUTER_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
                "HTTP-Referer": VISION_SCAN_CONFIG.HTTP_REFERER,
                "X-Title": VISION_SCAN_CONFIG.APP_TITLE,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new AppError(502, `OpenRouter API error (${response.status}): ${errorText}`);
        }

        const data = (await response.json()) as OpenRouterResponse;

        if (data.error) {
            throw new AppError(502, `Vision API error: ${data.error.message}`);
        }

        const rawText = data.choices?.[0]?.message?.content || "";
        const usage = data.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
        };

        let cleanText = rawText.trim();
        if (cleanText.startsWith("```")) {
            cleanText = cleanText
                .replace(/^```(?:json)?\n?/, "")
                .replace(/\n?```$/, "");
        }

        let extraction: AIExtractionResult;
        try {
            extraction = JSON.parse(cleanText);
        } catch {
            throw new AppError(500, `Failed to parse vision API response as JSON: ${cleanText.slice(0, 300)}`);
        }

        return { extraction, usage };
    }
}

export const visionScanService = new VisionScanService();
