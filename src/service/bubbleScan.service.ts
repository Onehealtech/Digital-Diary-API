import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { BubbleScanResult } from "../models/BubbleScanResult";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { DiaryPage } from "../models/DiaryPage";
import { Op } from "sequelize";
import { getDiaryTypeForCaseType } from "../utils/constants";

interface PythonOMROutput {
    success: boolean;
    pageNumber?: number;
    templateName?: string;
    templateVersion?: string;
    autoDetected?: boolean;
    results?: Record<
        string,
        {
            answer: "yes" | "no" | "uncertain";
            confidence: number;
            yesScore: number;
            noScore: number;
        }
    >;
    metadata?: {
        totalQuestions: number;
        answeredConfidently: number;
        uncertainCount: number;
        alignmentQuality: string;
        processingTimeMs: number;
    };
    error?: string;
    message?: string;
}

interface BubbleScanFilters {
    page?: number;
    limit?: number;
    templateName?: string;
    processingStatus?: string;
    patientId?: string;
    startDate?: Date;
    endDate?: Date;
    reviewed?: boolean;
    flagged?: boolean;
}

class BubbleScanService {
    private pythonScriptPath: string;
    private templatesDir: string;

    constructor() {
        this.pythonScriptPath = path.join(
            __dirname,
            "../../python/omr_scanner.py"
        );
        this.templatesDir = path.join(__dirname, "../../python/templates");
    }

    /**
     * Validate that a template exists
     */
    validateTemplate(templateName: string): boolean {
        const templatePath = path.join(
            this.templatesDir,
            `${templateName}.json`
        );
        return fs.existsSync(templatePath);
    }

    /**
     * Get available template names
     */
    getAvailableTemplates(): string[] {
        if (!fs.existsSync(this.templatesDir)) return [];
        return fs
            .readdirSync(this.templatesDir)
            .filter(
                (f) =>
                    f.endsWith(".json") && f !== "template_index.json"
            )
            .map((f) => f.replace(".json", ""));
    }

    /**
     * Manual submission: Patient fills answers directly in the app
     */
    async manualSubmit(
        patientId: string,
        pageNumber: number,
        answers: Record<string, "yes" | "no">,
        diaryType: string
    ): Promise<BubbleScanResult> {
        // Fetch the diary page from DB
        const diaryPage = await DiaryPage.findOne({
            where: { pageNumber, diaryType, isActive: true },
        });
        if (!diaryPage) {
            throw new Error(
                `Diary page ${pageNumber} not found for ${diaryType}`
            );
        }

        // Enrich answers with question text from DB
        const enrichedResults: Record<string, any> = {};
        for (const [qId, answer] of Object.entries(answers)) {
            const questionDef = diaryPage.questions.find(
                (q) => q.id === qId
            );
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

        return record;
    }

    /**
     * Main method: Process an uploaded bubble scan image
     * templateName is optional — defaults to "auto" which uses OCR to detect the page type
     */
    async processBubbleScan(
        patientId: string,
        pageId: string,
        templateName: string = "auto",
        imagePath: string,
        pageType?: string,
        diaryType?: string
    ): Promise<BubbleScanResult> {
        // Validate template exists (skip validation for "auto" mode — Python handles detection)
        if (templateName !== "auto" && !this.validateTemplate(templateName)) {
            throw new Error(
                `Template '${templateName}' not found. Available: ${this.getAvailableTemplates().join(", ")}`
            );
        }

        // Create DB record in "pending" status
        const scanRecord = await BubbleScanResult.create({
            patientId,
            pageId,
            pageType,
            templateName,
            submissionType: "scan",
            imageUrl: imagePath,
            processingStatus: "pending",
            scannedAt: new Date(),
        });

        try {
            // Update to "processing"
            await scanRecord.update({ processingStatus: "processing" });

            // Call Python script (passes "auto" or specific template name)
            const pythonResult = await this.executePythonOMR(
                imagePath,
                templateName
            );

            if (!pythonResult.success) {
                await scanRecord.update({
                    processingStatus: "failed",
                    errorMessage: `${pythonResult.error}: ${pythonResult.message}`,
                });
                return scanRecord;
            }

            // Resolve page number from Python output
            const detectedPageNumber = pythonResult.pageNumber;

            // Enrich results with question text from DB (instead of template files)
            const enrichedResults: Record<string, any> = {};
            const rawScores: Record<string, any> = {};
            let diaryPageId: string | undefined;

            if (pythonResult.results && detectedPageNumber) {
                const resolvedDiaryType = diaryType || getDiaryTypeForCaseType(undefined);
                const diaryPage = await DiaryPage.findOne({
                    where: {
                        pageNumber: detectedPageNumber,
                        diaryType: resolvedDiaryType,
                        isActive: true,
                    },
                });

                if (diaryPage) {
                    diaryPageId = diaryPage.id;
                    for (const [qId, qResult] of Object.entries(
                        pythonResult.results
                    )) {
                        const questionDef = diaryPage.questions.find(
                            (q) => q.id === qId
                        );
                        enrichedResults[qId] = {
                            answer: qResult.answer,
                            confidence: qResult.confidence,
                            questionText:
                                questionDef?.text || "Unknown question",
                            category:
                                questionDef?.category || "uncategorized",
                        };
                        rawScores[qId] = {
                            yesScore: qResult.yesScore,
                            noScore: qResult.noScore,
                        };
                    }
                } else {
                    // DiaryPage not found in DB — store raw results
                    for (const [qId, qResult] of Object.entries(
                        pythonResult.results
                    )) {
                        enrichedResults[qId] = {
                            answer: qResult.answer,
                            confidence: qResult.confidence,
                        };
                        rawScores[qId] = {
                            yesScore: qResult.yesScore,
                            noScore: qResult.noScore,
                        };
                    }
                }
            } else if (pythonResult.results) {
                // No page number detected — store raw results
                for (const [qId, qResult] of Object.entries(
                    pythonResult.results
                )) {
                    enrichedResults[qId] = {
                        answer: qResult.answer,
                        confidence: qResult.confidence,
                    };
                    rawScores[qId] = {
                        yesScore: qResult.yesScore,
                        noScore: qResult.noScore,
                    };
                }
            }

            // Update record with results
            await scanRecord.update({
                processingStatus: "completed",
                templateName:
                    pythonResult.templateName || templateName,
                pageNumber: detectedPageNumber,
                diaryPageId,
                scanResults: enrichedResults,
                rawConfidenceScores: rawScores,
                templateVersion: pythonResult.templateVersion,
                processingMetadata: {
                    ...pythonResult.metadata,
                    autoDetected: pythonResult.autoDetected || false,
                },
            });

            return scanRecord;
        } catch (error: any) {
            await scanRecord.update({
                processingStatus: "failed",
                errorMessage: error.message || "Unexpected processing error",
            });
            throw error;
        }
    }

    /**
     * Execute Python OMR script as child process
     */
    private executePythonOMR(
        imagePath: string,
        templateName: string
    ): Promise<PythonOMROutput> {
        return new Promise((resolve, reject) => {
            const proc = spawn("/home/ubuntu/Digital-Diary-API/python/venv/bin/python", [
                "python/omr_scanner.py",
                imagePath,templateName
            ]);

            let stdout = "";
            let stderr = "";

            proc.stdout.on("data", (data) => {
                stdout += data.toString();
            });

            proc.stderr.on("data", (data) => {
                stderr += data.toString();
            });

            // Timeout after 30 seconds
            const timeout = setTimeout(() => {
                proc.kill("SIGTERM");
                reject(
                    new Error("Python OMR script timed out after 30 seconds")
                );
            }, 30000);

            proc.on("close", (code) => {
                clearTimeout(timeout);

                if (code !== 0 && !stdout.trim()) {
                    reject(
                        new Error(
                            `Python script exited with code ${code}. Stderr: ${stderr}`
                        )
                    );
                    return;
                }

                try {
                    const result = JSON.parse(stdout.trim());
                    resolve(result);
                } catch {
                    reject(
                        new Error(
                            `Failed to parse Python output as JSON. stdout: ${stdout}, stderr: ${stderr}`
                        )
                    );
                }
            });

            proc.on("error", (err) => {
                clearTimeout(timeout);
                reject(
                    new Error(
                        `Failed to spawn Python process: ${err.message}. Ensure python3 is installed.`
                    )
                );
            });
        });
    }

    /**
     * Get scan history for a patient (paginated)
     */
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

    /**
     * Get a single scan result by ID
     */
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

    /**
     * Retry a failed scan
     */
    async retryScan(scanId: string): Promise<BubbleScanResult> {
        const existing = await BubbleScanResult.findByPk(scanId);
        if (!existing) throw new Error("Scan not found");
        if (existing.processingStatus !== "failed") {
            throw new Error("Can only retry failed scans");
        }

        // Look up patient to resolve diary type from caseType
        const patient = await Patient.findByPk(existing.patientId, {
            attributes: ["caseType"],
        });
        const diaryType = getDiaryTypeForCaseType(patient?.caseType);

        // Delete the failed record and reprocess
        const { patientId, pageId, templateName, imageUrl, pageType } =
            existing;
        await existing.destroy();

        return this.processBubbleScan(
            patientId,
            pageId,
            templateName,
            imageUrl!,
            pageType,
            diaryType
        );
    }

    /**
     * Doctor reviews a bubble scan result
     */
    async reviewBubbleScan(
        scanId: string,
        doctorId: string,
        data: {
            doctorNotes?: string;
            flagged?: boolean;
            overrides?: Record<string, "yes" | "no">;
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

        // Process doctor overrides on individual answers
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
            }

            updateData.doctorOverrides = existingOverrides;
            updateData.scanResults = currentResults;
        }

        await scan.update(updateData);
        return scan;
    }

    /**
     * Get all bubble scans for doctor review (with filters)
     */
    async getAllBubbleScans(
        doctorId: string,
        role: string,
        filters: BubbleScanFilters = {}
    ) {
        const {
            page = 1,
            limit = 20,
            templateName,
            processingStatus,
            patientId,
            startDate,
            endDate,
            reviewed,
            flagged,
        } = filters;

        const offset = (page - 1) * limit;

        // Get the doctor ID (if assistant, find their parent doctor)
        let resolvedDoctorId = doctorId;
        if (role === "ASSISTANT") {
            const assistant = await AppUser.findByPk(doctorId);
            if (!assistant || !assistant.parentId) {
                throw new Error("Assistant not linked to a doctor");
            }
            resolvedDoctorId = assistant.parentId;
        }

        // Get patient IDs belonging to this doctor
        const patients = await Patient.findAll({
            where: { doctorId: resolvedDoctorId },
            attributes: ["id"],
            raw: true,
        });
        const patientIds = patients.map((p: any) => p.id);

        const whereClause: any = {
            patientId: { [Op.in]: patientIds },
        };

        if (templateName) whereClause.templateName = templateName;
        if (processingStatus)
            whereClause.processingStatus = processingStatus;
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

export const bubbleScanService = new BubbleScanService();
