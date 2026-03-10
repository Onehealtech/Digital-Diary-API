"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bubbleScanService = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const BubbleScanResult_1 = require("../models/BubbleScanResult");
const ScanLog_1 = require("../models/ScanLog");
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const DiaryPage_1 = require("../models/DiaryPage");
const sequelize_1 = require("sequelize");
const constants_1 = require("../utils/constants");
const pythonPath = path_1.default.join(__dirname, "../../python/venv/bin/python3");
class BubbleScanService {
    constructor() {
        this.pythonScriptPath = path_1.default.join(__dirname, "../../python/omr_scanner.py");
        this.templatesDir = path_1.default.join(__dirname, "../../python/templates");
    }
    /**
     * Validate that a template exists
     */
    validateTemplate(templateName) {
        const templatePath = path_1.default.join(this.templatesDir, `${templateName}.json`);
        return fs_1.default.existsSync(templatePath);
    }
    /**
     * Get available template names
     */
    getAvailableTemplates() {
        if (!fs_1.default.existsSync(this.templatesDir))
            return [];
        return fs_1.default
            .readdirSync(this.templatesDir)
            .filter((f) => f.endsWith(".json") && f !== "template_index.json")
            .map((f) => f.replace(".json", ""));
    }
    /**
     * Manual submission: Patient fills answers directly in the app
     */
    async manualSubmit(patientId, pageNumber, answers, diaryType) {
        // Fetch the diary page from DB
        const diaryPage = await DiaryPage_1.DiaryPage.findOne({
            where: { pageNumber, diaryType, isActive: true },
        });
        if (!diaryPage) {
            throw new Error(`Diary page ${pageNumber} not found for ${diaryType}`);
        }
        // Enrich answers with question text from DB
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
        const record = await BubbleScanResult_1.BubbleScanResult.create({
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
    async processBubbleScan(patientId, pageId, templateName = "auto", imagePath, pageType, diaryType) {
        // Validate template exists (skip validation for "auto" mode — Python handles detection)
        if (templateName !== "auto" && !this.validateTemplate(templateName)) {
            throw new Error(`Template '${templateName}' not found. Available: ${this.getAvailableTemplates().join(", ")}`);
        }
        // Create DB record in "pending" status
        const scanRecord = await BubbleScanResult_1.BubbleScanResult.create({
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
            const pythonResult = await this.executePythonOMR(imagePath, templateName);
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
            const enrichedResults = {};
            const rawScores = {};
            let diaryPageId;
            if (pythonResult.results && detectedPageNumber) {
                const resolvedDiaryType = diaryType || (0, constants_1.getDiaryTypeForCaseType)(undefined);
                const diaryPage = await DiaryPage_1.DiaryPage.findOne({
                    where: {
                        pageNumber: detectedPageNumber,
                        diaryType: resolvedDiaryType,
                        isActive: true,
                    },
                });
                if (diaryPage) {
                    diaryPageId = diaryPage.id;
                    for (const [qId, qResult] of Object.entries(pythonResult.results)) {
                        const questionDef = diaryPage.questions.find((q) => q.id === qId);
                        enrichedResults[qId] = {
                            answer: qResult.answer,
                            confidence: qResult.confidence,
                            questionText: questionDef?.text || "Unknown question",
                            category: questionDef?.category || "uncategorized",
                        };
                        rawScores[qId] = {
                            yesScore: qResult.yesScore,
                            noScore: qResult.noScore,
                        };
                    }
                }
                else {
                    // DiaryPage not found in DB — store raw results
                    for (const [qId, qResult] of Object.entries(pythonResult.results)) {
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
            }
            else if (pythonResult.results) {
                // No page number detected — store raw results
                for (const [qId, qResult] of Object.entries(pythonResult.results)) {
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
                templateName: pythonResult.templateName || templateName,
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
                const scanData = {};
                for (const [qId, qResult] of Object.entries(enrichedResults)) {
                    const r = qResult;
                    scanData[qId] = r.answer;
                    if (r.questionText) {
                        scanData[`${qId}_text`] = r.questionText;
                    }
                }
                const existingScanLog = await ScanLog_1.ScanLog.findOne({
                    where: { patientId, pageId: scanLogPageId },
                });
                if (existingScanLog) {
                    await existingScanLog.update({
                        scanData,
                        scannedAt: new Date(),
                        isUpdated: true,
                        updatedCount: existingScanLog.updatedCount + 1,
                    });
                }
                else {
                    await ScanLog_1.ScanLog.create({
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
        }
        catch (error) {
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
    executePythonOMR(imagePath, templateName) {
        return new Promise((resolve, reject) => {
            const proc = (0, child_process_1.spawn)(pythonPath, [
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
                reject(new Error("Python OMR script timed out after 30 seconds"));
            }, 30000);
            proc.on("close", (code) => {
                clearTimeout(timeout);
                if (code !== 0 && !stdout.trim()) {
                    reject(new Error(`Python script exited with code ${code}. Stderr: ${stderr}`));
                    return;
                }
                try {
                    const result = JSON.parse(stdout.trim());
                    resolve(result);
                }
                catch {
                    reject(new Error(`Failed to parse Python output as JSON. stdout: ${stdout}, stderr: ${stderr}`));
                }
            });
            proc.on("error", (err) => {
                clearTimeout(timeout);
                reject(new Error(`Failed to spawn Python process: ${err.message}. Ensure python3 is installed.`));
            });
        });
    }
    /**
     * Get scan history for a patient (paginated)
     */
    async getPatientScanHistory(patientId, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const { rows, count } = await BubbleScanResult_1.BubbleScanResult.findAndCountAll({
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
    async getScanById(scanId) {
        const scan = await BubbleScanResult_1.BubbleScanResult.findByPk(scanId, {
            include: [
                {
                    model: Patient_1.Patient,
                    as: "patient",
                    attributes: ["id", "age", "gender", "stage"],
                },
            ],
        });
        if (!scan)
            throw new Error("Bubble scan result not found");
        return scan;
    }
    /**
     * Retry a failed scan
     */
    async retryScan(scanId) {
        const existing = await BubbleScanResult_1.BubbleScanResult.findByPk(scanId);
        if (!existing)
            throw new Error("Scan not found");
        if (existing.processingStatus !== "failed") {
            throw new Error("Can only retry failed scans");
        }
        // Look up patient to resolve diary type from caseType
        const patient = await Patient_1.Patient.findByPk(existing.patientId, {
            attributes: ["caseType"],
        });
        const diaryType = (0, constants_1.getDiaryTypeForCaseType)(patient?.caseType);
        // Delete the failed record and reprocess
        const { patientId, pageId, templateName, imageUrl, pageType } = existing;
        await existing.destroy();
        return this.processBubbleScan(patientId, pageId, templateName, imageUrl, pageType, diaryType);
    }
    /**
     * Doctor reviews a bubble scan result
     */
    async reviewBubbleScan(scanId, doctorId, data) {
        const scan = await BubbleScanResult_1.BubbleScanResult.findByPk(scanId);
        if (!scan)
            throw new Error("Bubble scan result not found");
        const updateData = {
            doctorReviewed: true,
            reviewedBy: doctorId,
            reviewedAt: new Date(),
        };
        if (data.doctorNotes !== undefined)
            updateData.doctorNotes = data.doctorNotes;
        if (data.flagged !== undefined)
            updateData.flagged = data.flagged;
        // Process doctor overrides on individual answers
        if (data.overrides && Object.keys(data.overrides).length > 0) {
            const existingOverrides = scan.doctorOverrides || {};
            const currentResults = scan.scanResults || {};
            for (const [qId, correctedAnswer] of Object.entries(data.overrides)) {
                if (!currentResults[qId])
                    continue;
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
    async getAllBubbleScans(doctorId, role, filters = {}) {
        const { page = 1, limit = 20, templateName, processingStatus, patientId, startDate, endDate, reviewed, flagged, } = filters;
        const offset = (page - 1) * limit;
        // Get the doctor ID (if assistant, find their parent doctor)
        let resolvedDoctorId = doctorId;
        if (role === "ASSISTANT") {
            const assistant = await Appuser_1.AppUser.findByPk(doctorId);
            if (!assistant || !assistant.parentId) {
                throw new Error("Assistant not linked to a doctor");
            }
            resolvedDoctorId = assistant.parentId;
        }
        // Get patient IDs belonging to this doctor
        const patients = await Patient_1.Patient.findAll({
            where: { doctorId: resolvedDoctorId },
            attributes: ["id"],
            raw: true,
        });
        const patientIds = patients.map((p) => p.id);
        const whereClause = {
            patientId: { [sequelize_1.Op.in]: patientIds },
        };
        if (templateName)
            whereClause.templateName = templateName;
        if (processingStatus)
            whereClause.processingStatus = processingStatus;
        if (patientId)
            whereClause.patientId = patientId;
        if (reviewed !== undefined)
            whereClause.doctorReviewed = reviewed;
        if (flagged !== undefined)
            whereClause.flagged = flagged;
        if (startDate || endDate) {
            whereClause.scannedAt = {};
            if (startDate)
                whereClause.scannedAt[sequelize_1.Op.gte] = startDate;
            if (endDate)
                whereClause.scannedAt[sequelize_1.Op.lte] = endDate;
        }
        const { rows, count } = await BubbleScanResult_1.BubbleScanResult.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Patient_1.Patient,
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
exports.bubbleScanService = new BubbleScanService();
