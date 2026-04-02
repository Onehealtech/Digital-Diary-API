import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { BubbleScanResult } from "../models/BubbleScanResult";
import { ScanLog } from "../models/ScanLog";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { DiaryPage } from "../models/DiaryPage";
import { DoctorPatientHistory } from "../models/DoctorPatientHistory";
import { Op } from "sequelize";
import { getDiaryTypeForCaseType } from "../utils/constants";
import { AppError } from "../utils/AppError";
import { uploadBufferToS3, buildReportS3Key, buildQuestionReportS3Key } from "../utils/s3Upload";
const pythonPath = path.join(__dirname, "../../python/venv/bin/python3");


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

interface DiaryFilterOptions {
    pageNumber: number;
    questionId?: string;        // Optional: filter/show answer for a specific question
    filter?: "submitted" | "not_submitted" | "all";  // Default: "all"
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
     * Manual submission: Patient fills answers directly in the app.
     * Optionally attach report files per question in the same call.
     * questionReportPairs: [{ questionId, file }] — one entry per uploaded file.
     */
    async manualSubmit(
        patientId: string,
        pageNumber: number,
        answers: Record<string, "yes" | "no">,
        diaryType: string,
        questionReportPairs: Array<{
            questionId: string;
            file: { buffer: Buffer; mimetype: string; originalname: string };
        }> = []
    ): Promise<BubbleScanResult> {
        // Fetch the diary page from DB
        const diaryPage = await DiaryPage.findOne({
            where: { pageNumber, diaryType, isActive: true },
        });

        if (!diaryPage) {
            throw new Error(`Diary page ${pageNumber} not found for ${diaryType}`);
        }

        // Enrich answers with question text from DB
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

        // Build questionReports map by uploading files to S3
        const questionReports: Record<string, string[]> = {};
        for (const { questionId, file } of questionReportPairs) {
            const qid = questionId.trim();
            const key = buildQuestionReportS3Key(patientId, "pending", qid, file.originalname, file.mimetype);
            const url = await uploadBufferToS3(file.buffer, file.mimetype, key);
            questionReports[qid] = [...(questionReports[qid] ?? []), url];
        }

        const record = await BubbleScanResult.create({
            patientId,
            pageId: `page-${pageNumber}`,
            pageNumber,
            diaryPageId: diaryPage.id,
            submissionType: "manual",
            processingStatus: "completed",
            scanResults: enrichedResults,
            questionReports,
            scannedAt: new Date(),
        });

        // Re-upload with the real scanId in the S3 key if reports were attached
        if (questionReportPairs.length > 0) {
            const fixedReports: Record<string, string[]> = {};
            for (const { questionId, file } of questionReportPairs) {
                const qid = questionId.trim();
                const key = buildQuestionReportS3Key(patientId, record.id, qid, file.originalname, file.mimetype);
                const url = await uploadBufferToS3(file.buffer, file.mimetype, key);
                fixedReports[qid] = [...(fixedReports[qid] ?? []), url];
            }
            record.questionReports = fixedReports;
            record.changed("questionReports", true);
            await record.save();
        }

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

            // Also sync to ScanLog so doctor diary entries screen can see it
            if (detectedPageNumber && Object.keys(enrichedResults).length > 0) {
                const scanLogPageId = `backend_page_${detectedPageNumber}`;
                // Convert enriched results to flat scanData format
                const scanData: Record<string, any> = {};
                for (const [qId, qResult] of Object.entries(enrichedResults)) {
                    const r = qResult as any;
                    scanData[qId] = r.answer;
                    if (r.questionText) {
                        scanData[`${qId}_text`] = r.questionText;
                    }
                }

                const existingScanLog = await ScanLog.findOne({
                    where: { patientId, pageId: scanLogPageId },
                });

                if (existingScanLog) {
                    await existingScanLog.update({
                        scanData,
                        scannedAt: new Date(),
                        isUpdated: true,
                        updatedCount: existingScanLog.updatedCount + 1,
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
            const proc = spawn(pythonPath, [
                this.pythonScriptPath,
                imagePath,
                templateName,
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
     * Get a single scan result by ID.
     * When called with doctorId/role, enforces assignment period for old doctors.
     */
    async getScanById(scanId: string, doctorId?: string, role?: string) {
        const scan = await BubbleScanResult.findByPk(scanId, {
            include: [
                { model: Patient, as: "patient", attributes: ["id", "age", "gender", "stage", "doctorId"] },
                { model: DiaryPage, as: "diaryPage", attributes: ["pageNumber", "layoutType", "questions"], required: false },
            ],
        });
        if (!scan) throw new Error("Bubble scan result not found");

        // If doctor context provided, enforce date cutoff for old doctors
        if (doctorId && role) {
            let resolvedDoctorId = doctorId;
            if (role === "ASSISTANT") {
                const assistant = await AppUser.findByPk(doctorId);
                if (!assistant || !assistant.parentId) throw new Error("Assistant not linked to a doctor");
                resolvedDoctorId = assistant.parentId;
            }

            const patient = (scan as any).patient;
            if (patient && patient.doctorId !== resolvedDoctorId) {
                // Old doctor — check history cutoff
                const history = await DoctorPatientHistory.findOne({
                    where: { patientId: scan.patientId, doctorId: resolvedDoctorId, unassignedAt: { [Op.ne]: null } },
                    order: [["unassignedAt", "DESC"]],
                });
                if (!history) throw new Error("Bubble scan result not found or access denied");
                if (scan.scannedAt > history.unassignedAt!) {
                    throw new Error("Bubble scan result not found or access denied");
                }
            }
        }

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
            questionMarks?: Record<string, boolean>;
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
        if (data.questionMarks !== undefined) updateData.questionMarks = data.questionMarks;

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
     * Get all bubble scans for doctor review (with filters).
     * Current patients: all scans visible.
     * Historical patients: only scans up to unassignment date.
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

        // If filtering by specific patient, apply date cutoff for old doctors
        if (patientId) {
            const patient = await Patient.findByPk(patientId, { attributes: ["doctorId"] });
            let cutoff: Date | null = null;

            if (!patient || patient.doctorId !== resolvedDoctorId) {
                // Check history for old doctor
                const history = await DoctorPatientHistory.findOne({
                    where: { patientId, doctorId: resolvedDoctorId, unassignedAt: { [Op.ne]: null } },
                    order: [["unassignedAt", "DESC"]],
                });
                if (!history) throw new Error("Access denied");
                cutoff = history.unassignedAt!;
            }

            const whereClause: any = { patientId, submissionType: { [Op.ne]: "doctor_manual" } };
            if (cutoff) {
                whereClause.scannedAt = { [Op.lte]: cutoff };
            }
            if (templateName) whereClause.templateName = templateName;
            if (processingStatus) whereClause.processingStatus = processingStatus;
            if (reviewed !== undefined) whereClause.doctorReviewed = reviewed;
            if (flagged !== undefined) whereClause.flagged = flagged;
            if (startDate || endDate) {
                whereClause.scannedAt = { ...(whereClause.scannedAt || {}) };
                if (startDate) whereClause.scannedAt[Op.gte] = startDate;
                if (endDate && (!cutoff || new Date(endDate as any) < cutoff)) {
                    whereClause.scannedAt[Op.lte] = endDate;
                }
            }

            const { rows, count } = await BubbleScanResult.findAndCountAll({
                where: whereClause,
                include: [
                    { model: Patient, as: "patient", attributes: ["id", "age", "gender", "stage"] },
                    { model: DiaryPage, as: "diaryPage", attributes: ["pageNumber", "layoutType", "questions"], required: false },
                ],
                order: [["scannedAt", "DESC"]],
                limit,
                offset,
            });

            return {
                scans: rows,
                pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
            };
        }

        // No specific patient — get current + historical patients
        const currentPatients = await Patient.findAll({
            where: { doctorId: resolvedDoctorId },
            attributes: ["id"],
            raw: true,
        });
        const currentPatientIds = currentPatients.map((p: any) => p.id);

        const historyRecords = await DoctorPatientHistory.findAll({
            where: { doctorId: resolvedDoctorId, unassignedAt: { [Op.ne]: null } },
            attributes: ["patientId", "unassignedAt"],
        });

        const currentSet = new Set(currentPatientIds);
        const historicalMap = new Map<string, Date>();
        for (const h of historyRecords) {
            if (!currentSet.has(h.patientId) && h.unassignedAt) {
                const existing = historicalMap.get(h.patientId);
                if (!existing || h.unassignedAt > existing) {
                    historicalMap.set(h.patientId, h.unassignedAt);
                }
            }
        }

        // Build OR conditions
        const patientConditions: any[] = [];
        if (currentPatientIds.length > 0) {
            patientConditions.push({ patientId: { [Op.in]: currentPatientIds } });
        }
        for (const [hpId, cutoffDate] of historicalMap) {
            patientConditions.push({
                patientId: hpId,
                scannedAt: { [Op.lte]: cutoffDate },
            });
        }

        if (patientConditions.length === 0) {
            return { scans: [], pagination: { total: 0, page, limit, totalPages: 0 } };
        }

        const whereClause: any = { [Op.or]: patientConditions, submissionType: { [Op.ne]: "doctor_manual" } };

        if (templateName) whereClause.templateName = templateName;
        if (processingStatus) whereClause.processingStatus = processingStatus;
        if (reviewed !== undefined) whereClause.doctorReviewed = reviewed;
        if (flagged !== undefined) whereClause.flagged = flagged;

        if (startDate || endDate) {
            whereClause.scannedAt = { ...(whereClause.scannedAt || {}) };
            if (startDate) whereClause.scannedAt[Op.gte] = startDate;
            if (endDate) whereClause.scannedAt[Op.lte] = endDate;
        }

        const { rows, count } = await BubbleScanResult.findAndCountAll({
            where: whereClause,
            include: [
                { model: Patient, as: "patient", attributes: ["id", "age", "gender", "stage"] },
                { model: DiaryPage, as: "diaryPage", attributes: ["pageNumber", "layoutType", "questions"], required: false },
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
    /**
     * Edit a scan entry's answers.
     * Only scan-type submissions (submissionType: "scan") can be edited by the patient.
     * Updates scanResults with the new answers and marks it as edited.
     */
    async editScanEntry(
        scanId: string,
        patientId: string,
        answers: Record<string, any>
    ): Promise<BubbleScanResult> {
        const scan = await BubbleScanResult.findOne({
            where: { id: scanId, patientId },
        });

        if (!scan) {
            throw new AppError(404, "Scan entry not found");
        }

        if (scan.submissionType !== "scan") {
            throw new AppError(400, "Only scan entries can be edited. Manual entries should be resubmitted.");
        }

        if (scan.processingStatus !== "completed") {
            throw new AppError(400, "Can only edit completed scan entries");
        }

        // Merge new answers into existing scanResults
        const existingResults = (scan.scanResults || {}) as Record<string, any>;
        for (const [qId, answer] of Object.entries(answers)) {
            if (existingResults[qId]) {
                existingResults[qId].answer = answer;
                existingResults[qId].confidence = 1.0; // Patient-corrected = full confidence
                existingResults[qId].editedByPatient = true;
            } else {
                existingResults[qId] = {
                    answer,
                    confidence: 1.0,
                    editedByPatient: true,
                };
            }
        }

        // Spread to create a new reference so Sequelize detects JSONB change
        scan.scanResults = { ...existingResults } as any;
        scan.doctorReviewed = false; // Reset review since answers changed
        scan.changed('scanResults', true);
        await scan.save();

        // Sync corrected answers to ScanLog
        if (scan.pageNumber) {
            const scanLogPageId = `backend_page_${scan.pageNumber}`;
            const scanData: Record<string, any> = {};
            for (const [qId, qResult] of Object.entries(existingResults)) {
                const r = qResult as any;
                scanData[qId] = r.answer;
                if (r.questionText) {
                    scanData[`${qId}_text`] = r.questionText;
                }
            }

            const existingScanLog = await ScanLog.findOne({
                where: { patientId, pageId: scanLogPageId },
            });

            if (existingScanLog) {
                await existingScanLog.update({
                    scanData,
                    scannedAt: new Date(),
                    isUpdated: true,
                    updatedCount: existingScanLog.updatedCount + 1,
                    doctorReviewed: false,
                });
            }
        }

        return scan;
    }

    /**
     * Get doctor-prefilled question marks for a specific page (for patient app to show pre-filled checkboxes).
     * Returns the questionMarks from the latest doctor_manual record for this patient+page.
     */
    async getDoctorMarksForPage(patientId: string, pageNumber: number): Promise<Record<string, boolean>> {
        const record = await BubbleScanResult.findOne({
            where: { patientId, pageNumber, doctorReviewed: true },
            attributes: ["questionMarks"],
            order: [["createdAt", "DESC"]],
        });
        return (record?.questionMarks as Record<string, boolean>) ?? {};
    }

    /**
     * Doctor manually creates or updates an investigation report for a patient.
     * Used for pages with layoutType "investigation_summary" (pages 05 & 06).
     * Creates a new BubbleScanResult if none exists, or updates the existing one.
     */
    async doctorFillReport(
        patientId: string,
        doctorId: string,
        pageNumber: number,
        questionMarks: Record<string, boolean>,
        doctorNotes?: string,
        questionSelections?: Record<string, string>  // select-type answers (e.g. surgery: "BCS")
    ): Promise<BubbleScanResult> {
        // Verify doctor has access to this patient
        const patient = await Patient.findByPk(patientId, { attributes: ["id", "doctorId", "caseType"] });
        if (!patient) throw new Error("Patient not found");

        const isCurrentDoctor = patient.doctorId === doctorId;
        if (!isCurrentDoctor) {
            // Allow if old doctor (history check)
            const history = await DoctorPatientHistory.findOne({
                where: { patientId, doctorId, unassignedAt: { [Op.ne]: null } },
            });
            if (!history) throw new Error("Access denied: patient not assigned to this doctor");
        }

        // Resolve the DiaryPage for this pageNumber
        const resolvedDiaryType = getDiaryTypeForCaseType(patient.caseType);
        const diaryPage = await DiaryPage.findOne({
            where: { pageNumber, diaryType: resolvedDiaryType, isActive: true },
        });

        const pageId = `backend_page_${pageNumber}`;

        // Find existing BubbleScanResult for this patient + page
        const existing = await BubbleScanResult.findOne({
            where: { patientId, pageNumber },
            order: [["createdAt", "DESC"]],
        });

        if (existing) {
            await existing.update({
                questionMarks,
                doctorNotes: doctorNotes ?? existing.doctorNotes,
                doctorOverrides: questionSelections ?? existing.doctorOverrides ?? {},
                doctorReviewed: true,
                reviewedBy: doctorId,
                reviewedAt: new Date(),
                diaryPageId: diaryPage?.id ?? existing.diaryPageId,
            });
            return existing.reload({
                include: [
                    { model: DiaryPage, as: "diaryPage", attributes: ["pageNumber", "layoutType", "questions"], required: false },
                ],
            });
        }

        // Create new doctor-initiated record
        const created = await BubbleScanResult.create({
            patientId,
            pageId,
            pageNumber,
            diaryPageId: diaryPage?.id,
            submissionType: "manual",
            processingStatus: "completed",
            scanResults: {},
            questionMarks,
            doctorOverrides: questionSelections ?? {},
            doctorNotes,
            doctorReviewed: true,
            reviewedBy: doctorId,
            reviewedAt: new Date(),
            scannedAt: new Date(),
        });

        return created.reload({
            include: [
                { model: DiaryPage, as: "diaryPage", attributes: ["pageNumber", "layoutType", "questions"], required: false },
            ],
        });
    }

    /**
     * Doctor dashboard: get all patients with their submission status for a specific diary page.
     * Enables filtering like "who uploaded Mammogram", "who hasn't submitted page 5", etc.
     *
     * GET /api/v1/bubble-scan/doctor/diary-filter?pageNumber=5&questionId=q1&filter=submitted
     */
    async getDiaryFilteredPatients(
        doctorId: string,
        role: string,
        options: DiaryFilterOptions
    ) {
        const { pageNumber, questionId, filter = "all" } = options;

        // Resolve doctorId for assistants
        let resolvedDoctorId = doctorId;
        if (role === "ASSISTANT") {
            const assistant = await AppUser.findByPk(doctorId);
            if (!assistant || !assistant.parentId) {
                throw new AppError(400, "Assistant not linked to a doctor");
            }
            resolvedDoctorId = assistant.parentId;
        }

        // 1. Collect current patients
        const currentPatients = await Patient.findAll({
            where: { doctorId: resolvedDoctorId },
            attributes: ["id", "fullName", "age", "gender", "stage"],
            raw: true,
        }) as any[];

        const currentPatientIds = currentPatients.map((p: any) => p.id);
        const currentSet = new Set(currentPatientIds);

        // 2. Collect historical patients
        const historyRecords = await DoctorPatientHistory.findAll({
            where: { doctorId: resolvedDoctorId, unassignedAt: { [Op.ne]: null } },
            attributes: ["patientId", "unassignedAt"],
        });

        const historicalMap = new Map<string, Date>();
        for (const h of historyRecords) {
            if (!currentSet.has(h.patientId) && h.unassignedAt) {
                const existing = historicalMap.get(h.patientId);
                if (!existing || h.unassignedAt > existing) {
                    historicalMap.set(h.patientId, h.unassignedAt);
                }
            }
        }

        // Fetch historical patient details
        const historicalPatientIds = [...historicalMap.keys()];
        const historicalPatients = historicalPatientIds.length > 0
            ? await Patient.findAll({
                where: { id: { [Op.in]: historicalPatientIds } },
                attributes: ["id", "fullName", "age", "gender", "stage"],
                raw: true,
            }) as any[]
            : [];

        const allPatients = [...currentPatients, ...historicalPatients];
        if (allPatients.length === 0) {
            return {
                pageNumber,
                summary: { total: 0, submitted: 0, notSubmitted: 0 },
                patients: [],
            };
        }

        const allPatientIds = allPatients.map((p: any) => p.id);

        // 3. Single query: latest scan per patient for this pageNumber
        const scans = await BubbleScanResult.findAll({
            where: {
                patientId: { [Op.in]: allPatientIds },
                pageNumber,
                processingStatus: "completed",
            },
            attributes: ["id", "patientId", "submissionType", "scanResults", "questionMarks", "scannedAt"],
            order: [["scannedAt", "DESC"]],
            raw: true,
        }) as any[];

        // Build map: patientId -> latest scan (first due to DESC order)
        const scanMap = new Map<string, any>();
        for (const scan of scans) {
            if (!scanMap.has(scan.patientId)) {
                scanMap.set(scan.patientId, scan);
            }
        }

        // 4. Build result rows
        const rows = allPatients.map((patient: any) => {
            const scan = scanMap.get(patient.id) ?? null;
            const submitted = scan !== null;

            let questionAnswer: "yes" | "no" | "uncertain" | null = null;
            if (submitted && questionId) {
                const results = typeof scan.scanResults === "string"
                    ? JSON.parse(scan.scanResults)
                    : scan.scanResults ?? {};
                const marks = typeof scan.questionMarks === "string"
                    ? JSON.parse(scan.questionMarks)
                    : scan.questionMarks ?? {};
                // scanResults for patient submissions, questionMarks for doctor_manual
                if (results[questionId]?.answer !== undefined) {
                    questionAnswer = results[questionId].answer;
                } else if (marks[questionId] !== undefined) {
                    questionAnswer = marks[questionId] ? "yes" : "no";
                }
            }

            return {
                patientId: patient.id,
                fullName: patient.fullName,
                age: patient.age ?? null,
                gender: patient.gender ?? null,
                stage: patient.stage ?? null,
                isHistorical: !currentSet.has(patient.id),
                submitted,
                submittedAt: submitted ? scan.scannedAt : null,
                submissionType: submitted ? scan.submissionType : null,
                scanId: submitted ? scan.id : null,
                ...(questionId !== undefined && { questionAnswer }),
            };
        });

        // 5. Apply filter
        const filtered = filter === "submitted"
            ? rows.filter((r) => r.submitted)
            : filter === "not_submitted"
                ? rows.filter((r) => !r.submitted)
                : rows;

        const submittedCount = rows.filter((r) => r.submitted).length;

        return {
            pageNumber,
            summary: {
                total: rows.length,
                submitted: submittedCount,
                notSubmitted: rows.length - submittedCount,
            },
            patients: filtered,
        };
    }

    /**
     * Attach one or more report files (PDF / images) to an existing scan entry.
     * Files are uploaded to S3 and their URLs appended to reportUrls.
     * Can be called after both scan-type and manual-type submissions.
     */
    async attachReports(
        scanId: string,
        patientId: string,
        files: Array<{ buffer: Buffer; mimetype: string; originalname: string }>
    ): Promise<BubbleScanResult> {
        const scan = await BubbleScanResult.findOne({
            where: { id: scanId, patientId },
        });
        if (!scan) throw new AppError(404, "Scan entry not found");
        if (files.length === 0) throw new AppError(400, "No report files provided");

        const uploadedUrls: string[] = [];
        for (const file of files) {
            const key = buildReportS3Key(patientId, scanId, file.originalname, file.mimetype);
            const url = await uploadBufferToS3(file.buffer, file.mimetype, key);
            uploadedUrls.push(url);
        }

        const existing = Array.isArray(scan.reportUrls) ? (scan.reportUrls as string[]) : [];
        scan.reportUrls = [...existing, ...uploadedUrls];
        scan.changed("reportUrls", true);
        await scan.save();

        return scan;
    }

    /**
     * Remove a specific report URL from a scan entry (patient-initiated deletion).
     */
    async removeReport(
        scanId: string,
        patientId: string,
        reportUrl: string
    ): Promise<BubbleScanResult> {
        const scan = await BubbleScanResult.findOne({
            where: { id: scanId, patientId },
        });
        if (!scan) throw new AppError(404, "Scan entry not found");

        const existing = Array.isArray(scan.reportUrls) ? (scan.reportUrls as string[]) : [];
        const updated = existing.filter((u) => u !== reportUrl);
        if (updated.length === existing.length) {
            throw new AppError(404, "Report URL not found on this scan entry");
        }

        scan.reportUrls = updated;
        scan.changed("reportUrls", true);
        await scan.save();

        return scan;
    }

    /**
     * Attach report files to one or more questions in a single request.
     * pairs: [{ questionId, file }] — one entry per file.
     * Supports PDF, DOC, DOCX, and images.
     * Stored in questionReports: { "Q1": ["url1"], "Q2": ["url2"], ... }
     */
    async attachQuestionReports(
        scanId: string,
        patientId: string,
        pairs: Array<{ questionId: string; file: { buffer: Buffer; mimetype: string; originalname: string } }>
    ): Promise<BubbleScanResult> {
        const scan = await BubbleScanResult.findOne({
            where: { id: scanId, patientId },
        });
        if (!scan) throw new AppError(404, "Scan entry not found");
        if (pairs.length === 0) throw new AppError(400, "No question-file pairs provided");

        const updated = { ...((scan.questionReports ?? {}) as Record<string, string[]>) };

        for (const { questionId, file } of pairs) {
            const qid = questionId.trim();
            const key = buildQuestionReportS3Key(patientId, scanId, qid, file.originalname, file.mimetype);
            const url = await uploadBufferToS3(file.buffer, file.mimetype, key);
            updated[qid] = [...(Array.isArray(updated[qid]) ? updated[qid] : []), url];
        }

        scan.questionReports = updated;
        scan.changed("questionReports", true);
        await scan.save();

        return scan;
    }

    /**
     * Remove a specific report URL from a question in a scan entry.
     */
    async removeQuestionReport(
        scanId: string,
        patientId: string,
        questionId: string,
        reportUrl: string
    ): Promise<BubbleScanResult> {
        const scan = await BubbleScanResult.findOne({
            where: { id: scanId, patientId },
        });
        if (!scan) throw new AppError(404, "Scan entry not found");

        const existing = (scan.questionReports ?? {}) as Record<string, string[]>;
        const forQuestion = Array.isArray(existing[questionId]) ? existing[questionId] : [];
        const updated = forQuestion.filter((u) => u !== reportUrl);

        if (updated.length === forQuestion.length) {
            throw new AppError(404, "Report URL not found for this question");
        }

        const newMap = { ...existing };
        if (updated.length === 0) {
            delete newMap[questionId];
        } else {
            newMap[questionId] = updated;
        }

        scan.questionReports = newMap;
        scan.changed("questionReports", true);
        await scan.save();

        return scan;
    }
}

export const bubbleScanService = new BubbleScanService();
