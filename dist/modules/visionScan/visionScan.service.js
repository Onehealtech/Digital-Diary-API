"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visionScanService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const constants_1 = require("../../utils/constants");
const AppError_1 = require("../../utils/AppError");
const visionScan_repository_1 = require("./visionScan.repository");
const visionScan_prompts_1 = require("./visionScan.prompts");
const visionScan_config_1 = require("./visionScan.config");
const documentAI_service_1 = require("./documentAI.service");
const anthropic_service_1 = require("./anthropic.service");
const scanAnalysis_1 = require("./scanAnalysis");
const visionScan_types_1 = require("./visionScan.types");
class VisionScanService {
    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY || "";
        if (!this.apiKey) {
            console.error("[VisionScan] OPENROUTER_API_KEY is not set in .env — all scan uploads will fail with 401");
        }
        this.s3Client = new client_s3_1.S3Client({ region: visionScan_config_1.VISION_SCAN_CONFIG.S3_REGION });
    }
    async uploadToS3(buffer, mimeType, patientId, diaryType, pageNumber) {
        const ext = mimeType === "image/png" ? "png" : "jpg";
        const key = `${visionScan_config_1.VISION_SCAN_CONFIG.S3_KEY_PREFIX}/${patientId}/${diaryType}/page-${pageNumber}/${Date.now()}.${ext}`;
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: visionScan_config_1.VISION_SCAN_CONFIG.S3_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
        }));
        return `https://${visionScan_config_1.VISION_SCAN_CONFIG.S3_BUCKET}.s3.${visionScan_config_1.VISION_SCAN_CONFIG.S3_REGION}.amazonaws.com/${key}`;
    }
    async detectPageNumber(base64, mimeType) {
        const body = {
            model: visionScan_config_1.VISION_SCAN_CONFIG.MODEL,
            messages: [
                {
                    role: "system",
                    content: visionScan_prompts_1.VISION_SCAN_SYSTEM_PROMPT,
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: visionScan_prompts_1.PAGE_DETECTION_PROMPT },
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
            max_tokens: visionScan_config_1.VISION_SCAN_CONFIG.MAX_TOKENS,
        };
        const response = await fetch(visionScan_config_1.VISION_SCAN_CONFIG.OPENROUTER_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
                "HTTP-Referer": visionScan_config_1.VISION_SCAN_CONFIG.HTTP_REFERER,
                "X-Title": visionScan_config_1.VISION_SCAN_CONFIG.APP_TITLE,
            },
            body: JSON.stringify(body),
        });
        console.log(response, "response");
        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 401) {
                throw new AppError_1.AppError(502, "Scan service unavailable: invalid or missing OPENROUTER_API_KEY. Check .env.production on the server.");
            }
            throw new AppError_1.AppError(502, `Page detection API error (${response.status}): ${errorText}`);
        }
        const data = (await response.json());
        console.log("[PageDetection] API response:", JSON.stringify(data, null, 2));
        if (data.error) {
            throw new AppError_1.AppError(502, `Page detection error: ${data.error.message}`);
        }
        let rawText = data.choices?.[0]?.message?.content?.trim() || "";
        const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        if (rawText.startsWith("```")) {
            rawText = rawText
                .replace(/^```(?:json)?\n?/, "")
                .replace(/\n?```$/, "");
        }
        let parsed;
        try {
            parsed = JSON.parse(rawText);
        }
        catch {
            throw new AppError_1.AppError(500, `Failed to parse page detection response: ${rawText}`);
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
     * Process scan: detect page, validate, create record, run extraction, return completed result.
     */
    async processScan(patientId, pageNumber, imageBuffer, mimeType, diaryType) {
        const base64 = imageBuffer.toString("base64");
        let detectedPageNumber;
        if (pageNumber) {
            detectedPageNumber = pageNumber;
        }
        else {
            const detection = await this.detectPageNumber(base64, mimeType);
            if (!detection.valid)
                return detection;
            detectedPageNumber = detection.pageNumber;
        }
        // Run DB lookup and S3 upload in parallel
        const [diaryPage, s3Url] = await Promise.all([
            visionScan_repository_1.visionScanRepository.findDiaryPage(detectedPageNumber, diaryType),
            this.uploadToS3(imageBuffer, mimeType, patientId, diaryType, detectedPageNumber),
        ]);
        if (!diaryPage) {
            throw new AppError_1.AppError(404, `Diary page ${detectedPageNumber} not found for diary type "${diaryType}"`);
        }
        const scanRecord = await visionScan_repository_1.visionScanRepository.createScanRecord({
            patientId,
            pageNumber: detectedPageNumber,
            diaryPageId: diaryPage.id,
            submissionType: visionScan_types_1.SubmissionType.SCAN,
            processingStatus: visionScan_types_1.ProcessingStatus.PROCESSING,
            imageUrl: s3Url,
        });
        // Run extraction inline and await completion so the response includes results
        await this.processExtraction({
            scanRecordId: scanRecord.id,
            base64,
            mimeType,
            diaryType,
            detectedPageNumber,
            patientId,
        });
        // Reload the scan record with completed extraction data
        const completedRecord = await visionScan_repository_1.visionScanRepository.findScanById(scanRecord.id);
        return completedRecord || scanRecord;
    }
    /**
     * Background worker: runs the actual AI extraction and updates the scan record.
     */
    async processExtraction(data) {
        const scanRecord = await visionScan_repository_1.visionScanRepository.findScanById(data.scanRecordId);
        if (!scanRecord) {
            console.error(`[VisionScan] Scan record ${data.scanRecordId} not found, skipping extraction`);
            return null;
        }
        const diaryPage = await visionScan_repository_1.visionScanRepository.findDiaryPage(data.detectedPageNumber, data.diaryType);
        if (!diaryPage) {
            await visionScan_repository_1.visionScanRepository.updateScanFailed(scanRecord, `Diary page ${data.detectedPageNumber} not found for "${data.diaryType}"`);
            return null;
        }
        try {
            const useAnthropic = process.env.USE_ANTHROPIC === "true" && (0, anthropic_service_1.isAnthropicConfigured)();
            const useDocAI = !useAnthropic && process.env.USE_DOCUMENT_AI === "true" && (0, documentAI_service_1.isDocumentAIConfigured)();
            let enrichedResults = {};
            let rawConfidenceScores = {};
            let lowConfidenceFields = [];
            let metadata = {
                model: "", promptTokens: 0, responseTokens: 0,
                totalTokens: 0, processingTimeMs: 0, lowConfidenceFields: [],
            };
            if (useAnthropic) {
                // ─── Anthropic Claude Vision (Sharp preprocessing + claude-sonnet) ─
                const imageBuffer = Buffer.from(data.base64, "base64");
                let anthropicFailed = false;
                try {
                    const result = await (0, anthropic_service_1.extractWithAnthropic)(imageBuffer, data.detectedPageNumber, diaryPage.title, diaryPage.questions);
                    const built = this.buildEnrichedResults(diaryPage.questions, result.extraction);
                    enrichedResults = built.enrichedResults;
                    rawConfidenceScores = built.rawConfidenceScores;
                    lowConfidenceFields = built.lowConfidenceFields;
                    metadata = {
                        model: "anthropic/claude-sonnet-4-20250514",
                        promptTokens: 0,
                        responseTokens: 0,
                        totalTokens: 0,
                        processingTimeMs: result.processingTimeMs,
                        lowConfidenceFields,
                    };
                }
                catch (anthropicErr) {
                    // Auth / network failures fall back to OpenRouter so the scan isn't lost.
                    // Configuration errors (invalid key, timeout) are logged clearly.
                    console.error(`[VisionScan] Anthropic failed — falling back to OpenRouter. Reason: ${anthropicErr.message}`);
                    anthropicFailed = true;
                }
                if (anthropicFailed) {
                    // ─── OpenRouter fallback ─────────────────────────────────────
                    const prompt = (0, visionScan_prompts_1.buildExtractionPrompt)(diaryPage);
                    const startTime = Date.now();
                    const aiResult = await this.callVisionApi(data.base64, data.mimeType, prompt);
                    const processingTimeMs = Date.now() - startTime;
                    const built = this.buildEnrichedResults(diaryPage.questions, aiResult.extraction);
                    enrichedResults = built.enrichedResults;
                    rawConfidenceScores = built.rawConfidenceScores;
                    lowConfidenceFields = built.lowConfidenceFields;
                    metadata = {
                        model: `${visionScan_config_1.VISION_SCAN_CONFIG.MODEL} (anthropic-fallback)`,
                        promptTokens: aiResult.usage.prompt_tokens,
                        responseTokens: aiResult.usage.completion_tokens,
                        totalTokens: aiResult.usage.total_tokens,
                        processingTimeMs,
                        lowConfidenceFields,
                    };
                }
            }
            else if (useDocAI) {
                // ─── Google Document AI (trained custom extractor) ───────────
                const imageBuffer = Buffer.from(data.base64, "base64");
                const docResult = await (0, documentAI_service_1.extractWithDocumentAI)(imageBuffer, data.mimeType, diaryPage.questions);
                const built = this.buildEnrichedResults(diaryPage.questions, docResult.extraction);
                enrichedResults = built.enrichedResults;
                rawConfidenceScores = built.rawConfidenceScores;
                lowConfidenceFields = built.lowConfidenceFields;
                metadata = {
                    model: "google-document-ai-custom",
                    promptTokens: 0,
                    responseTokens: 0,
                    totalTokens: 0,
                    processingTimeMs: docResult.usage.processingTimeMs,
                    lowConfidenceFields,
                };
            }
            else {
                // ─── OpenRouter LLM (prompt-based fallback) ─────────────────
                const prompt = (0, visionScan_prompts_1.buildExtractionPrompt)(diaryPage);
                const startTime = Date.now();
                const aiResult = await this.callVisionApi(data.base64, data.mimeType, prompt);
                const processingTimeMs = Date.now() - startTime;
                const built = this.buildEnrichedResults(diaryPage.questions, aiResult.extraction);
                enrichedResults = built.enrichedResults;
                rawConfidenceScores = built.rawConfidenceScores;
                lowConfidenceFields = built.lowConfidenceFields;
                metadata = {
                    model: visionScan_config_1.VISION_SCAN_CONFIG.MODEL,
                    promptTokens: aiResult.usage.prompt_tokens,
                    responseTokens: aiResult.usage.completion_tokens,
                    totalTokens: aiResult.usage.total_tokens,
                    processingTimeMs,
                    lowConfidenceFields,
                };
            }
            // ── Scan analysis: rescan / rejection decision ────────────────
            const warnings = [
                ...lowConfidenceFields.map(f => `Low confidence: ${f}`),
            ];
            const historicalDates = await visionScan_repository_1.visionScanRepository.findHistoricalDatesForPage(data.patientId, data.detectedPageNumber, data.scanRecordId // exclude the record currently being processed
            );
            const analysis = (0, scanAnalysis_1.computeScanAnalysis)(enrichedResults, diaryPage.questions, warnings, historicalDates);
            // Merge analysis into metadata so it's stored and returned in the response
            metadata = {
                ...metadata,
                action: analysis.action,
                rescanRequired: analysis.rescanRequired,
                rescanReasons: analysis.rescanReasons,
                rejectionRequired: analysis.rejectionRequired,
                rejectionReasons: analysis.rejectionReasons,
                dataError: analysis.dataError,
                alertMessage: analysis.alertMessage,
                userMessage: analysis.userMessage,
                dataReliable: analysis.dataReliable,
                overallConfidence: analysis.overallConfidence,
                warnings,
            };
            await Promise.all([
                visionScan_repository_1.visionScanRepository.updateScanCompleted(scanRecord, {
                    scanResults: enrichedResults,
                    rawConfidenceScores,
                    processingMetadata: metadata,
                    flagged: analysis.rescanRequired || analysis.rejectionRequired,
                }),
                visionScan_repository_1.visionScanRepository.syncToScanLog(data.patientId, data.detectedPageNumber, enrichedResults),
            ]);
            return enrichedResults;
        }
        catch (error) {
            await visionScan_repository_1.visionScanRepository.updateScanFailed(scanRecord, error.message || "Unexpected processing error");
            throw error;
        }
    }
    async manualSubmit(patientId, pageNumber, answers, diaryType) {
        const diaryPage = await visionScan_repository_1.visionScanRepository.findDiaryPage(pageNumber, diaryType);
        console.log(diaryPage, "diaryPage");
        if (!diaryPage) {
            throw new AppError_1.AppError(404, `Diary page ${pageNumber} not found for ${diaryType}`);
        }
        const enrichedResults = {};
        for (const [qId, answer] of Object.entries(answers)) {
            const questionDef = diaryPage.questions.find((q) => q.id === qId);
            enrichedResults[qId] = {
                answer,
                confidence: 1.0,
                questionText: questionDef?.text || "Unknown question",
                category: questionDef?.category || "uncategorized",
            };
        }
        console.log(enrichedResults, "enrichedResults");
        const record = await visionScan_repository_1.visionScanRepository.createScanRecord({
            patientId,
            pageNumber,
            diaryPageId: diaryPage.id,
            submissionType: visionScan_types_1.SubmissionType.MANUAL,
            processingStatus: visionScan_types_1.ProcessingStatus.COMPLETED,
            scanResults: enrichedResults,
        });
        console.log(`Manual submission saved for patient ${patientId}, page ${pageNumber}`);
        console.log(record, "record");
        await visionScan_repository_1.visionScanRepository.syncToScanLog(patientId, pageNumber, enrichedResults);
        return record;
    }
    async retryScan(scanId) {
        const existing = await visionScan_repository_1.visionScanRepository.findScanById(scanId);
        if (!existing)
            throw new AppError_1.AppError(404, "Scan not found");
        if (existing.processingStatus !== visionScan_types_1.ProcessingStatus.FAILED) {
            throw new AppError_1.AppError(400, "Can only retry failed scans");
        }
        const caseType = await visionScan_repository_1.visionScanRepository.findPatientCaseType(existing.patientId);
        const diaryType = (0, constants_1.getDiaryTypeForCaseType)(caseType);
        const { patientId, pageNumber, imageUrl } = existing;
        if (!pageNumber || !imageUrl) {
            throw new AppError_1.AppError(400, "Missing pageNumber or imageUrl on failed scan");
        }
        // Download image from S3, reset status, and re-queue extraction
        const { buffer, mimeType } = await this.downloadFromS3(imageUrl);
        const base64 = buffer.toString("base64");
        await existing.update({ processingStatus: visionScan_types_1.ProcessingStatus.PROCESSING, errorMessage: null });
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
    async downloadFromS3(s3Url) {
        // Extract key from S3 URL
        const url = new URL(s3Url);
        const key = url.pathname.slice(1); // remove leading /
        const response = await this.s3Client.send(new client_s3_1.GetObjectCommand({
            Bucket: visionScan_config_1.VISION_SCAN_CONFIG.S3_BUCKET,
            Key: key,
        }));
        const bodyBytes = await response.Body?.transformToByteArray();
        if (!bodyBytes)
            throw new AppError_1.AppError(500, "Empty response from S3");
        return {
            buffer: Buffer.from(bodyBytes),
            mimeType: response.ContentType || "image/jpeg",
        };
    }
    async getPatientScanHistory(patientId, page = 1, limit = 20) {
        return visionScan_repository_1.visionScanRepository.getPatientScans(patientId, page, limit);
    }
    async getScanById(scanId) {
        const scan = await visionScan_repository_1.visionScanRepository.findScanByIdWithPatient(scanId);
        if (!scan)
            throw new AppError_1.AppError(404, "Bubble scan result not found");
        return scan;
    }
    async reviewScan(scanId, doctorId, data) {
        const scan = await visionScan_repository_1.visionScanRepository.findScanById(scanId);
        if (!scan)
            throw new AppError_1.AppError(404, "Bubble scan result not found");
        return visionScan_repository_1.visionScanRepository.updateScanReview(scan, doctorId, data);
    }
    async getAllScans(doctorId, role, filters = {}) {
        return visionScan_repository_1.visionScanRepository.getDoctorPatientScans(doctorId, role, filters);
    }
    /**
     * Normalize any AI-returned date value to "DD/MM/YYYY" with a numeric month.
     * Handles: "DD/Mon/YYYY" (legacy), "DD/MM/YYYY" (current), ISO "YYYY-MM-DD".
     * Leaves non-date fields and null values untouched.
     */
    normalizeDateFormat(value, questionType) {
        if (!value || questionType !== "date")
            return value;
        const MONTH_TO_NUM = {
            jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
            jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
        };
        // Already DD/MM/YYYY
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(value))
            return value;
        // DD/Mon/YYYY → DD/MM/YYYY
        const nameMatch = value.match(/^(\d{2})\/([A-Za-z]{3})\/(\d{4})$/);
        if (nameMatch) {
            const mm = MONTH_TO_NUM[nameMatch[2].toLowerCase()];
            if (mm)
                return `${nameMatch[1]}/${mm}/${nameMatch[3]}`;
        }
        // ISO YYYY-MM-DD → DD/MM/YYYY
        const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (isoMatch)
            return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
        return value; // unrecognised — keep as-is
    }
    buildEnrichedResults(questions, extraction) {
        const enrichedResults = {};
        const rawConfidenceScores = {};
        const lowConfidenceFields = [];
        for (const question of questions) {
            if (question.type === "info")
                continue;
            const aiField = extraction[question.id];
            if (aiField) {
                enrichedResults[question.id] = {
                    answer: this.normalizeDateFormat(aiField.value, question.type),
                    confidence: aiField.confidence,
                    questionText: question.text,
                    category: question.category,
                };
                rawConfidenceScores[question.id] = aiField.confidence;
                if (aiField.confidence <
                    visionScan_config_1.VISION_SCAN_CONFIG.LOW_CONFIDENCE_THRESHOLD) {
                    lowConfidenceFields.push(`${question.id}: ${question.text} (${aiField.confidence})`);
                }
            }
            else {
                enrichedResults[question.id] = {
                    answer: null,
                    confidence: 0,
                    questionText: question.text,
                    category: question.category,
                };
                lowConfidenceFields.push(`${question.id}: ${question.text} (missing from AI response)`);
            }
        }
        return { enrichedResults, rawConfidenceScores, lowConfidenceFields };
    }
    async callVisionApi(base64, mimeType, prompt) {
        const body = {
            model: visionScan_config_1.VISION_SCAN_CONFIG.MODEL,
            messages: [
                {
                    role: "system",
                    content: visionScan_prompts_1.VISION_SCAN_SYSTEM_PROMPT,
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
            temperature: visionScan_config_1.VISION_SCAN_CONFIG.TEMPERATURE,
            max_tokens: visionScan_config_1.VISION_SCAN_CONFIG.MAX_TOKENS,
        };
        const response = await fetch(visionScan_config_1.VISION_SCAN_CONFIG.OPENROUTER_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
                "HTTP-Referer": visionScan_config_1.VISION_SCAN_CONFIG.HTTP_REFERER,
                "X-Title": visionScan_config_1.VISION_SCAN_CONFIG.APP_TITLE,
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new AppError_1.AppError(502, `OpenRouter API error (${response.status}): ${errorText}`);
        }
        const data = (await response.json());
        if (data.error) {
            throw new AppError_1.AppError(502, `Vision API error: ${data.error.message}`);
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
        let extraction;
        try {
            extraction = JSON.parse(cleanText);
        }
        catch {
            throw new AppError_1.AppError(500, `Failed to parse vision API response as JSON: ${cleanText.slice(0, 300)}`);
        }
        return { extraction, usage };
    }
}
exports.visionScanService = new VisionScanService();
