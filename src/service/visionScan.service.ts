import fs from "fs";
import path from "path";
import { BubbleScanResult } from "../models/BubbleScanResult";
import { ScanLog } from "../models/ScanLog";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { DiaryPage } from "../models/DiaryPage";
import { Op } from "sequelize";
import { getDiaryTypeForCaseType } from "../utils/constants";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const MAX_TOKENS = 2048;
const LOW_CONFIDENCE_THRESHOLD = 0.8;

const EXTRACTION_PROMPT = `You are analyzing a photograph of a medical diary page (CANTrac Breast Cancer Diary).

Your task:
1. Identify the page number (printed at the top).
2. Identify the page title/heading.
3. Extract ONLY the SELECTED values — do NOT list every option, only what the patient filled in.

CRITICAL BUBBLE DETECTION RULES:
- A FILLED bubble is a SOLID DARK circle (blue/black ink, completely filled). It is distinctly darker and heavier than empty bubbles.
- An EMPTY bubble is a HOLLOW circle with just a thin outline — light/white inside.
- SPATIAL LAYOUT: For Yes/No rows, "Yes" with its bubble is ALWAYS on the LEFT. "No" with its bubble is ALWAYS on the RIGHT. Carefully check which SIDE has the solid dark bubble.
- For each row, visually compare BOTH bubbles. One will be clearly darker/filled. Report the one that is filled (left=Yes, right=No).
- IGNORE the left checkbox column (those are for doctors only).
- For date fields (DD/MM/YY bubbles), combine into a single date string like "03/Mar/2026".
- For status fields (Scheduled/Completed/Missed/Cancelled), return only the selected one.
- For Yes/No fields, return "Yes" or "No".
- If a field has no bubble filled, return null for value and 1.0 for confidence (you're confident it's empty).
- If a page has multiple sections (e.g. "First Appointment", "Second Attempt"), group them.
- For each field, include a confidence score (0.0 to 1.0) for how certain you are about the detected value.
  - 0.9-1.0: bubble is clearly filled or clearly empty
  - 0.7-0.9: fairly sure but lighting/angle makes it slightly ambiguous
  - Below 0.7: genuinely uncertain, could be either option

Return ONLY valid JSON (no markdown, no code fences, no explanation):
{
  "page_number": <int>,
  "page_title": "<string>",
  "sections": [
    {
      "section_title": "<section name or 'Main' if no sections>",
      "fields": [
        { "field": "<field label in English>", "value": "<selected value or null>", "confidence": <0.0-1.0> }
      ]
    }
  ],
  "overall_confidence": "high|medium|low",
  "notes": "<any issues or null>"
}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface OpenRouterResponse {
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

interface ExtractedField {
    field: string;
    value: string | null;
    confidence: number;
}

interface ExtractedSection {
    section_title: string;
    fields: ExtractedField[];
}

interface AIExtractionResult {
    page_number: number;
    page_title: string;
    sections: ExtractedSection[];
    overall_confidence: string;
    notes: string | null;
}

interface ProcessingMetadata {
    model: string;
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
    processingTimeMs: number;
    lowConfidenceFields: string[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    // Core: Process an uploaded diary page image
    // -----------------------------------------------------------------------
    async processScan(
        patientId: string,
        pageId: string,
        imagePath: string,
        diaryType?: string
    ): Promise<BubbleScanResult> {
        // 1. Create DB record in "pending" status
        const scanRecord = await BubbleScanResult.create({
            patientId,
            pageId,
            submissionType: "scan",
            imageUrl: imagePath,
            processingStatus: "pending",
            scannedAt: new Date(),
        });

        try {
            // 2. Update to "processing"
            await scanRecord.update({ processingStatus: "processing" });

            // 3. Call Gemini via OpenRouter
            const startTime = Date.now();
            const aiResult = await this.callVisionApi(imagePath);
            const processingTimeMs = Date.now() - startTime;

            // 4. Look up DiaryPage from DB using AI-detected page number
            const detectedPageNumber = aiResult.extraction.page_number;
            const resolvedDiaryType =
                diaryType || getDiaryTypeForCaseType(undefined);

            const diaryPage = await DiaryPage.findOne({
                where: {
                    pageNumber: detectedPageNumber,
                    diaryType: resolvedDiaryType,
                    isActive: true,
                },
            });

            // 5. Enrich AI results with DB question IDs
            const { enrichedResults, rawConfidenceScores, lowConfidenceFields } =
                this.enrichWithDbSchema(aiResult.extraction, diaryPage);

            // 6. Determine if flagging is needed
            const shouldFlag = lowConfidenceFields.length > 0;

            // 7. Build processing metadata
            const metadata: ProcessingMetadata = {
                model: MODEL,
                promptTokens: aiResult.usage.prompt_tokens,
                responseTokens: aiResult.usage.completion_tokens,
                totalTokens: aiResult.usage.total_tokens,
                processingTimeMs,
                lowConfidenceFields,
            };

            // 8. Update BubbleScanResult
            await scanRecord.update({
                processingStatus: "completed",
                pageNumber: detectedPageNumber,
                diaryPageId: diaryPage?.id,
                scanResults: enrichedResults,
                rawConfidenceScores: rawConfidenceScores,
                processingMetadata: metadata,
                flagged: shouldFlag,
            });

            // 9. Sync to ScanLog for doctor diary view
            await this.syncToScanLog(
                patientId,
                detectedPageNumber,
                enrichedResults
            );

            return scanRecord;
        } catch (error: any) {
            await scanRecord.update({
                processingStatus: "failed",
                errorMessage: error.message || "Unexpected processing error",
            });
            throw error;
        }
    }

    // -----------------------------------------------------------------------
    // Gemini Vision API call via OpenRouter
    // -----------------------------------------------------------------------
    private async callVisionApi(imagePath: string): Promise<{
        extraction: AIExtractionResult;
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    }> {
        // Read image as base64
        const imageBuffer = fs.readFileSync(imagePath);
        const ext = path.extname(imagePath).toLowerCase();
        const mimeMap: Record<string, string> = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
        };
        const mimeType = mimeMap[ext] || "image/jpeg";
        const base64 = imageBuffer.toString("base64");

        // Call OpenRouter
        const body = {
            model: MODEL,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: EXTRACTION_PROMPT },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mimeType};base64,${base64}`,
                            },
                        },
                    ],
                },
            ],
            temperature: 0.1,
            max_tokens: MAX_TOKENS,
        };

        const response = await fetch(OPENROUTER_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
                "HTTP-Referer": "https://onehealtech.com",
                "X-Title": "CANTrac Diary Scan",
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

        // Clean markdown fences if present
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

    // -----------------------------------------------------------------------
    // Match AI fields to DB DiaryPage questions and enrich
    // -----------------------------------------------------------------------
    private enrichWithDbSchema(
        extraction: AIExtractionResult,
        diaryPage: DiaryPage | null
    ): {
        enrichedResults: Record<string, any>;
        rawConfidenceScores: Record<string, number>;
        lowConfidenceFields: string[];
    } {
        const enrichedResults: Record<string, any> = {};
        const rawConfidenceScores: Record<string, number> = {};
        const lowConfidenceFields: string[] = [];

        // Flatten all fields from all sections
        const allFields: (ExtractedField & { sectionTitle: string })[] = [];
        for (const section of extraction.sections) {
            for (const field of section.fields) {
                allFields.push({ ...field, sectionTitle: section.section_title });
            }
        }

        if (diaryPage && diaryPage.questions) {
            // Match AI fields to DB questions by fuzzy text matching
            for (const dbQuestion of diaryPage.questions) {
                const dbText = dbQuestion.text.toLowerCase().trim();
                const dbId = dbQuestion.id;

                // Find best matching AI field
                const match = this.findBestMatch(dbText, allFields);

                if (match) {
                    enrichedResults[dbId] = {
                        answer: match.value,
                        confidence: match.confidence,
                        questionText: dbQuestion.text,
                        category: dbQuestion.category,
                        sectionTitle: match.sectionTitle,
                        aiFieldName: match.field,
                    };
                    rawConfidenceScores[dbId] = match.confidence;

                    if (match.confidence < LOW_CONFIDENCE_THRESHOLD) {
                        lowConfidenceFields.push(
                            `${dbId}: ${dbQuestion.text} (${match.confidence})`
                        );
                    }
                } else {
                    // No match found — store as unanswered
                    enrichedResults[dbId] = {
                        answer: null,
                        confidence: 0,
                        questionText: dbQuestion.text,
                        category: dbQuestion.category,
                        matchError: "No matching AI field found",
                    };
                    lowConfidenceFields.push(
                        `${dbId}: ${dbQuestion.text} (no match)`
                    );
                }
            }

            // Also store any AI fields that didn't match a DB question (for debugging)
            const matchedAiFields = new Set(
                Object.values(enrichedResults)
                    .map((r: any) => r.aiFieldName)
                    .filter(Boolean)
            );
            let unmatchedIdx = 0;
            for (const aiField of allFields) {
                if (!matchedAiFields.has(aiField.field)) {
                    const key = `_unmatched_${unmatchedIdx++}`;
                    enrichedResults[key] = {
                        answer: aiField.value,
                        confidence: aiField.confidence,
                        aiFieldName: aiField.field,
                        sectionTitle: aiField.sectionTitle,
                        matchError: "No matching DB question",
                    };
                }
            }
        } else {
            // No DiaryPage found in DB — store raw AI results
            let fieldIdx = 0;
            for (const aiField of allFields) {
                const key = `field_${fieldIdx++}`;
                enrichedResults[key] = {
                    answer: aiField.value,
                    confidence: aiField.confidence,
                    aiFieldName: aiField.field,
                    sectionTitle: aiField.sectionTitle,
                };
                rawConfidenceScores[key] = aiField.confidence;

                if (aiField.confidence < LOW_CONFIDENCE_THRESHOLD) {
                    lowConfidenceFields.push(
                        `${key}: ${aiField.field} (${aiField.confidence})`
                    );
                }
            }
        }

        return { enrichedResults, rawConfidenceScores, lowConfidenceFields };
    }

    // -----------------------------------------------------------------------
    // Fuzzy match an AI field name to a DB question text
    // -----------------------------------------------------------------------
    private findBestMatch(
        dbText: string,
        aiFields: (ExtractedField & { sectionTitle: string })[]
    ): (ExtractedField & { sectionTitle: string }) | null {
        let bestMatch: (ExtractedField & { sectionTitle: string }) | null = null;
        let bestScore = 0;

        for (const aiField of aiFields) {
            const aiText = aiField.field.toLowerCase().trim();
            const score = this.similarityScore(dbText, aiText);
            if (score > bestScore && score > 0.3) {
                bestScore = score;
                bestMatch = aiField;
            }
        }

        return bestMatch;
    }

    // -----------------------------------------------------------------------
    // Simple word-overlap similarity (good enough for matching)
    // -----------------------------------------------------------------------
    private similarityScore(a: string, b: string): number {
        const wordsA = new Set(
            a.split(/\s+/).filter((w) => w.length > 2)
        );
        const wordsB = new Set(
            b.split(/\s+/).filter((w) => w.length > 2)
        );

        if (wordsA.size === 0 || wordsB.size === 0) return 0;

        let overlap = 0;
        for (const word of wordsA) {
            if (wordsB.has(word)) overlap++;
        }

        // Jaccard similarity
        const union = new Set([...wordsA, ...wordsB]).size;
        return overlap / union;
    }

    // -----------------------------------------------------------------------
    // Sync results to ScanLog (flat format for doctor diary view)
    // -----------------------------------------------------------------------
    private async syncToScanLog(
        patientId: string,
        pageNumber: number,
        enrichedResults: Record<string, any>
    ): Promise<void> {
        const scanLogPageId = `backend_page_${pageNumber}`;

        // Convert to flat key-value
        const scanData: Record<string, any> = {};
        for (const [qId, qResult] of Object.entries(enrichedResults)) {
            if (qId.startsWith("_unmatched_")) continue; // Skip unmatched fields
            const r = qResult as any;
            scanData[qId] = r.answer;
            if (r.questionText) {
                scanData[`${qId}_text`] = r.questionText;
            }
        }

        const existing = await ScanLog.findOne({
            where: { patientId, pageId: scanLogPageId },
        });

        if (existing) {
            await existing.update({
                scanData,
                scannedAt: new Date(),
                isUpdated: true,
                updatedCount: existing.updatedCount + 1,
            });
        } else {
            await ScanLog.create({
                patientId,
                pageId: scanLogPageId,
                scanData,
                scannedAt: new Date(),
                isUpdated: false,
                updatedCount: 0,
            });
        }
    }

    // -----------------------------------------------------------------------
    // Manual submission (no AI — patient fills directly in app)
    // -----------------------------------------------------------------------
    async manualSubmit(
        patientId: string,
        pageNumber: number,
        answers: Record<string, string>,
        diaryType: string
    ): Promise<BubbleScanResult> {
        const diaryPage = await DiaryPage.findOne({
            where: { pageNumber, diaryType, isActive: true },
        });
        if (!diaryPage) {
            throw new Error(
                `Diary page ${pageNumber} not found for ${diaryType}`
            );
        }

        const enrichedResults: Record<string, any> = {};
        for (const [qId, answer] of Object.entries(answers)) {
            const questionDef = diaryPage.questions.find((q) => q.id === qId);
            enrichedResults[qId] = {
                answer,
                confidence: 1.0,
                questionText: questionDef?.text || "Unknown question",
                category: questionDef?.category || "uncategorized",
            };
        }

        const record = await BubbleScanResult.create({
            patientId,
            pageId: `page-${pageNumber}`,
            pageNumber,
            diaryPageId: diaryPage.id,
            submissionType: "manual",
            processingStatus: "completed",
            scanResults: enrichedResults,
            scannedAt: new Date(),
        });

        await this.syncToScanLog(patientId, pageNumber, enrichedResults);

        return record;
    }

    // -----------------------------------------------------------------------
    // Retry a failed scan
    // -----------------------------------------------------------------------
    async retryScan(scanId: string): Promise<BubbleScanResult> {
        const existing = await BubbleScanResult.findByPk(scanId);
        if (!existing) throw new Error("Scan not found");
        if (existing.processingStatus !== "failed") {
            throw new Error("Can only retry failed scans");
        }

        const patient = await Patient.findByPk(existing.patientId, {
            attributes: ["caseType"],
        });
        const diaryType = getDiaryTypeForCaseType(patient?.caseType);

        const { patientId, pageId, imageUrl } = existing;
        await existing.destroy();

        return this.processScan(patientId, pageId, imageUrl!, diaryType);
    }

    // -----------------------------------------------------------------------
    // Get scan history for a patient
    // -----------------------------------------------------------------------
    async getPatientScanHistory(patientId: string, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const { rows, count } = await BubbleScanResult.findAndCountAll({
            where: { patientId },
            order: [["scannedAt", "DESC"]],
            limit,
            offset,
        });
        return {
            scans: rows,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit),
            },
        };
    }

    // -----------------------------------------------------------------------
    // Get single scan by ID
    // -----------------------------------------------------------------------
    async getScanById(scanId: string) {
        const scan = await BubbleScanResult.findByPk(scanId, {
            include: [
                {
                    model: Patient,
                    as: "patient",
                    attributes: ["id", "age", "gender", "stage"],
                },
            ],
        });
        if (!scan) throw new Error("Bubble scan result not found");
        return scan;
    }

    // -----------------------------------------------------------------------
    // Doctor reviews a scan
    // -----------------------------------------------------------------------
    async reviewScan(
        scanId: string,
        doctorId: string,
        data: {
            doctorNotes?: string;
            flagged?: boolean;
            overrides?: Record<string, string>;
        }
    ) {
        const scan = await BubbleScanResult.findByPk(scanId);
        if (!scan) throw new Error("Bubble scan result not found");

        const updateData: any = {
            doctorReviewed: true,
            reviewedBy: doctorId,
            reviewedAt: new Date(),
        };

        if (data.doctorNotes !== undefined)
            updateData.doctorNotes = data.doctorNotes;
        if (data.flagged !== undefined) updateData.flagged = data.flagged;

        if (data.overrides && Object.keys(data.overrides).length > 0) {
            const existingOverrides = (scan.doctorOverrides as any) || {};
            const currentResults = (scan.scanResults as any) || {};

            for (const [qId, correctedAnswer] of Object.entries(
                data.overrides
            )) {
                if (!currentResults[qId]) continue;
                existingOverrides[qId] = {
                    originalAnswer: currentResults[qId].answer,
                    correctedAnswer,
                    overriddenAt: new Date().toISOString(),
                };
                currentResults[qId].answer = correctedAnswer;
                currentResults[qId].confidence = 1.0; // Doctor override = full confidence
            };

            updateData.doctorOverrides = existingOverrides;
            updateData.scanResults = currentResults;
        }

        await scan.update(updateData);
        return scan;
    }

    // -----------------------------------------------------------------------
    // Get all scans for doctor's patients (with filters)
    // -----------------------------------------------------------------------
    async getAllScans(
        doctorId: string,
        role: string,
        filters: {
            page?: number;
            limit?: number;
            processingStatus?: string;
            patientId?: string;
            startDate?: Date;
            endDate?: Date;
            reviewed?: boolean;
            flagged?: boolean;
        } = {}
    ) {
        const {
            page = 1,
            limit = 20,
            processingStatus,
            patientId,
            startDate,
            endDate,
            reviewed,
            flagged,
        } = filters;

        const offset = (page - 1) * limit;

        let resolvedDoctorId = doctorId;
        if (role === "ASSISTANT") {
            const assistant = await AppUser.findByPk(doctorId);
            if (!assistant || !assistant.parentId) {
                throw new Error("Assistant not linked to a doctor");
            }
            resolvedDoctorId = assistant.parentId;
        }

        const patients = await Patient.findAll({
            where: { doctorId: resolvedDoctorId },
            attributes: ["id"],
            raw: true,
        });
        const patientIds = patients.map((p: any) => p.id);

        const whereClause: any = {
            patientId: { [Op.in]: patientIds },
        };

        if (processingStatus) whereClause.processingStatus = processingStatus;
        if (patientId) whereClause.patientId = patientId;
        if (reviewed !== undefined) whereClause.doctorReviewed = reviewed;
        if (flagged !== undefined) whereClause.flagged = flagged;

        if (startDate || endDate) {
            whereClause.scannedAt = {};
            if (startDate) whereClause.scannedAt[Op.gte] = startDate;
            if (endDate) whereClause.scannedAt[Op.lte] = endDate;
        }

        const { rows, count } = await BubbleScanResult.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Patient,
                    as: "patient",
                    attributes: ["id", "age", "gender", "stage"],
                },
            ],
            order: [["scannedAt", "DESC"]],
            limit,
            offset,
        });

        return {
            scans: rows,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit),
            },
        };
    }
}

export const visionScanService = new VisionScanService();
