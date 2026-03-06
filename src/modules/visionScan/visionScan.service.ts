import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
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
            max_tokens: 100,
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

    async processScan(
        patientId: string,
        pageNumber: number | undefined,
        imageBuffer: Buffer,
        mimeType: string,
        diaryType: string
    ): Promise<BubbleScanResult | { valid: false; reason: string }> {
        const base64 = imageBuffer.toString("base64");
        let detectedPageNumber: number;
        let detectionUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

        if (pageNumber) {
            detectedPageNumber = pageNumber;
        } else {
            const detection = await this.detectPageNumber(base64, mimeType);
            if (!detection.valid) return detection;
            detectedPageNumber = detection.pageNumber;
            detectionUsage = detection.usage;
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

        const scanRecord = await visionScanRepository.createScanRecord({
            patientId,
            pageNumber: detectedPageNumber,
            diaryPageId: diaryPage.id,
            submissionType: SubmissionType.SCAN,
            processingStatus: ProcessingStatus.PROCESSING,
            imageUrl: s3Url,
        });

        try {
            const prompt = buildExtractionPrompt(diaryPage);
            const startTime = Date.now();
            const aiResult = await this.callVisionApi(base64, mimeType, prompt);
            const processingTimeMs = Date.now() - startTime;

            const { enrichedResults, rawConfidenceScores, lowConfidenceFields } =
                this.buildEnrichedResults(diaryPage.questions, aiResult.extraction);

            const metadata: ProcessingMetadata = {
                model: VISION_SCAN_CONFIG.MODEL,
                promptTokens: detectionUsage.prompt_tokens + aiResult.usage.prompt_tokens,
                responseTokens: detectionUsage.completion_tokens + aiResult.usage.completion_tokens,
                totalTokens: detectionUsage.total_tokens + aiResult.usage.total_tokens,
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
                    patientId,
                    detectedPageNumber,
                    enrichedResults
                ),
            ]);

            return scanRecord;
        } catch (error: any) {
            await visionScanRepository.updateScanFailed(
                scanRecord,
                error.message || "Unexpected processing error"
            );
            throw error;
        }
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

        const record = await visionScanRepository.createScanRecord({
            patientId,
            pageNumber,
            diaryPageId: diaryPage.id,
            submissionType: SubmissionType.MANUAL,
            processingStatus: ProcessingStatus.COMPLETED,
            scanResults: enrichedResults,
        });

        await visionScanRepository.syncToScanLog(
            patientId,
            pageNumber,
            enrichedResults
        );

        return record;
    }

    async retryScan(scanId: string): Promise<BubbleScanResult | { valid: false; reason: string }> {
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

        // Download image from S3 for reprocessing
        const { buffer, mimeType } = await this.downloadFromS3(imageUrl);
        await visionScanRepository.deleteScan(existing);

        return this.processScan(patientId, pageNumber, buffer, mimeType, diaryType);
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
