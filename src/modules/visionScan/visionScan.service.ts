import fs from "fs/promises";
import path from "path";
import { BubbleScanResult } from "../../models/BubbleScanResult";
import { getDiaryTypeForCaseType } from "../../utils/constants";
import { visionScanRepository } from "./visionScan.repository";
import { buildExtractionPrompt } from "./visionScan.prompts";
import { VISION_SCAN_CONFIG, MIME_TYPE_MAP } from "./visionScan.config";
import {
    AIExtractionResult,
    DiaryQuestion,
    EnrichedResult,
    OpenRouterResponse,
    ProcessingMetadata,
    ProcessingStatus,
    ReviewData,
    ScanFilterOptions,
    SubmissionType,
} from "./visionScan.types";

class VisionScanService {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY || "";
        if (!this.apiKey) {
            console.warn(
                "[VisionScan] OPENROUTER_API_KEY not set in .env — scan processing will fail"
            );
        }
    }

    async processScan(
        patientId: string,
        pageNumber: number,
        imagePath: string,
        diaryType: string
    ): Promise<BubbleScanResult> {
        const diaryPage = await visionScanRepository.findDiaryPage(
            pageNumber,
            diaryType
        );
        if (!diaryPage) {
            throw new Error(
                `Diary page ${pageNumber} not found for diary type "${diaryType}"`
            );
        }

        const scanRecord = await visionScanRepository.createScanRecord({
            patientId,
            pageNumber,
            diaryPageId: diaryPage.id,
            submissionType: SubmissionType.SCAN,
            processingStatus: ProcessingStatus.PROCESSING,
            imageUrl: imagePath,
        });

        try {
            const prompt = buildExtractionPrompt(diaryPage);
            const startTime = Date.now();
            const aiResult = await this.callVisionApi(imagePath, prompt);
            const processingTimeMs = Date.now() - startTime;

            const { enrichedResults, rawConfidenceScores, lowConfidenceFields } =
                this.buildEnrichedResults(diaryPage.questions, aiResult.extraction);

            const metadata: ProcessingMetadata = {
                model: VISION_SCAN_CONFIG.MODEL,
                promptTokens: aiResult.usage.prompt_tokens,
                responseTokens: aiResult.usage.completion_tokens,
                totalTokens: aiResult.usage.total_tokens,
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
                    pageNumber,
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
            throw new Error(
                `Diary page ${pageNumber} not found for ${diaryType}`
            );
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

    async retryScan(scanId: string): Promise<BubbleScanResult> {
        const existing = await visionScanRepository.findScanById(scanId);
        if (!existing) throw new Error("Scan not found");
        if (existing.processingStatus !== ProcessingStatus.FAILED) {
            throw new Error("Can only retry failed scans");
        }

        const caseType = await visionScanRepository.findPatientCaseType(
            existing.patientId
        );
        const diaryType = getDiaryTypeForCaseType(caseType);

        const { patientId, pageNumber, imageUrl } = existing;
        if (!pageNumber || !imageUrl) {
            throw new Error("Missing pageNumber or imageUrl on failed scan");
        }
        await visionScanRepository.deleteScan(existing);

        return this.processScan(patientId, pageNumber, imageUrl, diaryType);
    }

    async getPatientScanHistory(patientId: string, page = 1, limit = 20) {
        return visionScanRepository.getPatientScans(patientId, page, limit);
    }

    async getScanById(scanId: string) {
        const scan = await visionScanRepository.findScanByIdWithPatient(scanId);
        if (!scan) throw new Error("Bubble scan result not found");
        return scan;
    }

    async reviewScan(scanId: string, doctorId: string, data: ReviewData) {
        const scan = await visionScanRepository.findScanById(scanId);
        if (!scan) throw new Error("Bubble scan result not found");
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
        imagePath: string,
        prompt: string
    ): Promise<{
        extraction: AIExtractionResult;
        usage: {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
        };
    }> {
        const imageBuffer = await fs.readFile(imagePath);
        const ext = path.extname(imagePath).toLowerCase();
        const mimeType = MIME_TYPE_MAP[ext] || "image/jpeg";
        const base64 = imageBuffer.toString("base64");

        const body = {
            model: VISION_SCAN_CONFIG.MODEL,
            messages: [
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
            throw new Error(
                `OpenRouter API error (${response.status}): ${errorText}`
            );
        }

        const data = (await response.json()) as OpenRouterResponse;

        if (data.error) {
            throw new Error(`Vision API error: ${data.error.message}`);
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
            throw new Error(
                `Failed to parse vision API response as JSON: ${cleanText.slice(0, 300)}`
            );
        }

        return { extraction, usage };
    }
}

export const visionScanService = new VisionScanService();
