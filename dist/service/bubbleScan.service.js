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
const DoctorPatientHistory_1 = require("../models/DoctorPatientHistory");
const sequelize_1 = require("sequelize");
const constants_1 = require("../utils/constants");
const AppError_1 = require("../utils/AppError");
const s3Upload_1 = require("../utils/s3Upload");
const reportFiles_1 = require("../utils/reportFiles");
const diaryAccess_service_1 = require("./diaryAccess.service");
const pythonPath = path_1.default.join(__dirname, "../../python/venv/bin/python3");
class BubbleScanService {
    constructor() {
        this.pythonScriptPath = path_1.default.join(__dirname, "../../python/omr_scanner.py");
        this.templatesDir = path_1.default.join(__dirname, "../../python/templates");
    }
    enrichScanReportMetadata(scan, options = {}) {
        const reportFiles = (0, reportFiles_1.normalizeReportFiles)(scan.reportUrls);
        const questionReports = (0, reportFiles_1.normalizeQuestionReports)(scan.questionReports);
        scan.setDataValue("reportFiles", reportFiles);
        scan.setDataValue("questionReports", questionReports);
        if (options.reportUrlsMode === "objects") {
            scan.setDataValue("reportUrls", reportFiles);
        }
        else if (options.reportUrlsMode === "urls") {
            scan.setDataValue("reportUrls", reportFiles.map((file) => file.url));
        }
        return scan;
    }
    enrichManyScanReportMetadata(scans, options = {}) {
        return scans.map((scan) => this.enrichScanReportMetadata(scan, options));
    }
    async resolveDoctorId(requesterId, role) {
        if (role === "ASSISTANT") {
            const assistant = await Appuser_1.AppUser.findByPk(requesterId);
            if (!assistant || !assistant.parentId) {
                throw new AppError_1.AppError(400, "Assistant not linked to a doctor");
            }
            return assistant.parentId;
        }
        if (role !== "DOCTOR") {
            throw new AppError_1.AppError(403, "Only doctors and assistants can access bubble scans");
        }
        return requesterId;
    }
    async getDoctorPatientCutoff(patientId, doctorId) {
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(patientId);
        const patient = await Patient_1.Patient.findByPk(patientId, {
            attributes: ["doctorId"],
        });
        if (patient?.doctorId === doctorId) {
            return null;
        }
        const history = await DoctorPatientHistory_1.DoctorPatientHistory.findOne({
            where: { patientId, doctorId, unassignedAt: { [sequelize_1.Op.ne]: null } },
            order: [["unassignedAt", "DESC"]],
        });
        if (!history?.unassignedAt) {
            throw new AppError_1.AppError(403, "Bubble scan result not found or access denied");
        }
        return history.unassignedAt;
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
     * Manual submission: Patient fills answers directly in the app.
     * Optionally attach report files per question in the same call.
     * questionReportPairs: [{ questionId, file }] — one entry per uploaded file.
     */
    async manualSubmit(patientId, pageNumber, answers, diaryType, questionReportPairs = []) {
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(patientId);
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
        // Build questionReports map by uploading files to S3
        const questionReports = {};
        for (const { questionId, file } of questionReportPairs) {
            const qid = questionId.trim();
            const key = (0, s3Upload_1.buildQuestionReportS3Key)(patientId, "pending", qid, file.originalname, file.mimetype);
            const url = await (0, s3Upload_1.uploadBufferToS3)(file.buffer, file.mimetype, key);
            questionReports[qid] = [...(questionReports[qid] ?? []), { url, name: file.originalname }];
        }
        const record = await BubbleScanResult_1.BubbleScanResult.create({
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
            const fixedReports = {};
            for (const { questionId, file } of questionReportPairs) {
                const qid = questionId.trim();
                const key = (0, s3Upload_1.buildQuestionReportS3Key)(patientId, record.id, qid, file.originalname, file.mimetype);
                const url = await (0, s3Upload_1.uploadBufferToS3)(file.buffer, file.mimetype, key);
                fixedReports[qid] = [...(fixedReports[qid] ?? []), { url, name: file.originalname }];
            }
            record.questionReports = fixedReports;
            record.changed("questionReports", true);
            await record.save();
        }
        return this.enrichScanReportMetadata(record, { reportUrlsMode: "urls" });
    }
    /**
     * Main method: Process an uploaded bubble scan image
     * templateName is optional — defaults to "auto" which uses OCR to detect the page type
     */
    async processBubbleScan(patientId, pageId, templateName = "auto", imagePath, pageType, diaryType) {
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(patientId);
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
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(patientId);
        const offset = (page - 1) * limit;
        const { rows, count } = await BubbleScanResult_1.BubbleScanResult.findAndCountAll({
            where: { patientId },
            order: [["scannedAt", "DESC"]],
            limit,
            offset,
        });
        return {
            scans: this.enrichManyScanReportMetadata(rows, { reportUrlsMode: "urls" }),
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
    async getScanById(scanId, requesterId, role) {
        const scan = await BubbleScanResult_1.BubbleScanResult.findByPk(scanId, {
            include: [
                { model: Patient_1.Patient, as: "patient", attributes: ["id", "age", "gender", "stage", "doctorId"] },
                { model: DiaryPage_1.DiaryPage, as: "diaryPage", attributes: ["pageNumber", "layoutType", "questions"], required: false },
            ],
        });
        if (!scan)
            throw new Error("Bubble scan result not found");
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(scan.patientId);
        if (requesterId && role === "PATIENT") {
            if (scan.patientId !== requesterId) {
                throw new AppError_1.AppError(403, "Bubble scan result not found or access denied");
            }
            return this.enrichScanReportMetadata(scan, { reportUrlsMode: "urls" });
        }
        // If doctor context provided, enforce date cutoff for old doctors
        if (requesterId && role) {
            const resolvedDoctorId = await this.resolveDoctorId(requesterId, role);
            const cutoff = await this.getDoctorPatientCutoff(scan.patientId, resolvedDoctorId);
            if (cutoff && scan.scannedAt > cutoff) {
                throw new AppError_1.AppError(403, "Bubble scan result not found or access denied");
            }
        }
        return this.enrichScanReportMetadata(scan, { reportUrlsMode: "objects" });
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
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(existing.patientId);
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
    async reviewBubbleScan(scanId, requesterId, role, data) {
        const scan = await BubbleScanResult_1.BubbleScanResult.findByPk(scanId, {
            include: [{ model: Patient_1.Patient, as: "patient", attributes: ["id", "doctorId"] }],
        });
        if (!scan)
            throw new Error("Bubble scan result not found");
        const resolvedDoctorId = await this.resolveDoctorId(requesterId, role);
        const cutoff = await this.getDoctorPatientCutoff(scan.patientId, resolvedDoctorId);
        if (cutoff && scan.scannedAt > cutoff) {
            throw new AppError_1.AppError(403, "Bubble scan result not found or access denied");
        }
        const updateData = {
            doctorReviewed: true,
            reviewedBy: resolvedDoctorId,
            reviewedAt: new Date(),
        };
        if (data.doctorNotes !== undefined)
            updateData.doctorNotes = data.doctorNotes;
        if (data.flagged !== undefined)
            updateData.flagged = data.flagged;
        if (data.questionMarks !== undefined)
            updateData.questionMarks = data.questionMarks;
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
        return this.enrichScanReportMetadata(scan, { reportUrlsMode: "objects" });
    }
    /**
     * Get all bubble scans for doctor review (with filters).
     * Current patients: all scans visible.
     * Historical patients: only scans up to unassignment date.
     */
    async getAllBubbleScans(doctorId, role, filters = {}) {
        const { page = 1, limit = 20, templateName, processingStatus, patientId, startDate, endDate, reviewed, flagged, } = filters;
        const offset = (page - 1) * limit;
        const resolvedDoctorId = await this.resolveDoctorId(doctorId, role);
        // If filtering by specific patient, apply date cutoff for old doctors
        if (patientId) {
            const cutoff = await this.getDoctorPatientCutoff(patientId, resolvedDoctorId);
            const whereClause = { patientId, submissionType: { [sequelize_1.Op.ne]: "doctor_manual" } };
            if (cutoff) {
                whereClause.scannedAt = { [sequelize_1.Op.lte]: cutoff };
            }
            if (templateName)
                whereClause.templateName = templateName;
            if (processingStatus)
                whereClause.processingStatus = processingStatus;
            if (reviewed !== undefined)
                whereClause.doctorReviewed = reviewed;
            if (flagged !== undefined)
                whereClause.flagged = flagged;
            if (startDate || endDate) {
                whereClause.scannedAt = { ...(whereClause.scannedAt || {}) };
                if (startDate)
                    whereClause.scannedAt[sequelize_1.Op.gte] = startDate;
                if (endDate && (!cutoff || new Date(endDate) < cutoff)) {
                    whereClause.scannedAt[sequelize_1.Op.lte] = endDate;
                }
            }
            const { rows, count } = await BubbleScanResult_1.BubbleScanResult.findAndCountAll({
                where: whereClause,
                include: [
                    { model: Patient_1.Patient, as: "patient", attributes: ["id", "age", "gender", "stage"] },
                    { model: DiaryPage_1.DiaryPage, as: "diaryPage", attributes: ["pageNumber", "layoutType", "questions"], required: false },
                ],
                order: [["scannedAt", "DESC"]],
                limit,
                offset,
            });
            return {
                scans: this.enrichManyScanReportMetadata(rows, { reportUrlsMode: "objects" }),
                pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
            };
        }
        // No specific patient — get current + historical patients
        const currentPatients = await Patient_1.Patient.findAll({
            where: { doctorId: resolvedDoctorId },
            attributes: ["id"],
            raw: true,
        });
        const approvedCurrentPatientIds = await (0, diaryAccess_service_1.filterPatientsWithApprovedDiaries)(currentPatients.map((p) => p.id));
        const currentPatientIds = currentPatients
            .map((p) => p.id)
            .filter((patientId) => approvedCurrentPatientIds.has(patientId));
        const historyRecords = await DoctorPatientHistory_1.DoctorPatientHistory.findAll({
            where: { doctorId: resolvedDoctorId, unassignedAt: { [sequelize_1.Op.ne]: null } },
            attributes: ["patientId", "unassignedAt"],
        });
        const currentSet = new Set(currentPatientIds);
        const historicalMap = new Map();
        for (const h of historyRecords) {
            if (!currentSet.has(h.patientId) && h.unassignedAt) {
                const existing = historicalMap.get(h.patientId);
                if (!existing || h.unassignedAt > existing) {
                    historicalMap.set(h.patientId, h.unassignedAt);
                }
            }
        }
        const approvedHistoricalPatientIds = await (0, diaryAccess_service_1.filterPatientsWithApprovedDiaries)(Array.from(historicalMap.keys()));
        // Build OR conditions
        const patientConditions = [];
        if (currentPatientIds.length > 0) {
            patientConditions.push({ patientId: { [sequelize_1.Op.in]: currentPatientIds } });
        }
        for (const [hpId, cutoffDate] of historicalMap) {
            if (!approvedHistoricalPatientIds.has(hpId)) {
                continue;
            }
            patientConditions.push({
                patientId: hpId,
                scannedAt: { [sequelize_1.Op.lte]: cutoffDate },
            });
        }
        if (patientConditions.length === 0) {
            return { scans: [], pagination: { total: 0, page, limit, totalPages: 0 } };
        }
        const whereClause = { [sequelize_1.Op.or]: patientConditions, submissionType: { [sequelize_1.Op.ne]: "doctor_manual" } };
        if (templateName)
            whereClause.templateName = templateName;
        if (processingStatus)
            whereClause.processingStatus = processingStatus;
        if (reviewed !== undefined)
            whereClause.doctorReviewed = reviewed;
        if (flagged !== undefined)
            whereClause.flagged = flagged;
        if (startDate || endDate) {
            whereClause.scannedAt = { ...(whereClause.scannedAt || {}) };
            if (startDate)
                whereClause.scannedAt[sequelize_1.Op.gte] = startDate;
            if (endDate)
                whereClause.scannedAt[sequelize_1.Op.lte] = endDate;
        }
        const { rows, count } = await BubbleScanResult_1.BubbleScanResult.findAndCountAll({
            where: whereClause,
            include: [
                { model: Patient_1.Patient, as: "patient", attributes: ["id", "age", "gender", "stage"] },
                { model: DiaryPage_1.DiaryPage, as: "diaryPage", attributes: ["pageNumber", "layoutType", "questions"], required: false },
            ],
            order: [["scannedAt", "DESC"]],
            limit,
            offset,
        });
        return {
            scans: this.enrichManyScanReportMetadata(rows, { reportUrlsMode: "objects" }),
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
    async editScanEntry(scanId, patientId, answers) {
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(patientId);
        const scan = await BubbleScanResult_1.BubbleScanResult.findOne({
            where: { id: scanId, patientId },
        });
        if (!scan) {
            throw new AppError_1.AppError(404, "Scan entry not found");
        }
        if (scan.submissionType !== "scan") {
            throw new AppError_1.AppError(400, "Only scan entries can be edited. Manual entries should be resubmitted.");
        }
        if (scan.processingStatus !== "completed") {
            throw new AppError_1.AppError(400, "Can only edit completed scan entries");
        }
        // Validate second-attempt fields: q2_date and q2_status can only be set
        // if q1_status is "Missed" or "Cancelled"
        const SECOND_ATTEMPT_FIELDS = ["q2_date", "q2_status"];
        const hasSecondAttemptEdit = SECOND_ATTEMPT_FIELDS.some(f => f in answers);
        if (hasSecondAttemptEdit) {
            const existingResults = (scan.scanResults || {});
            const q1StatusIncoming = answers["q1_status"];
            const q1StatusExisting = existingResults["q1_status"]?.answer ?? existingResults["q1_status"];
            const q1Status = q1StatusIncoming ?? q1StatusExisting;
            if (!["Missed", "Cancelled"].includes(q1Status)) {
                throw new AppError_1.AppError(400, "Second attempt date and status can only be filled when the first attempt status is Missed or Cancelled");
            }
        }
        // Merge new answers into existing scanResults
        const existingResults = (scan.scanResults || {});
        for (const [qId, answer] of Object.entries(answers)) {
            if (existingResults[qId]) {
                existingResults[qId].answer = answer;
                existingResults[qId].confidence = 1.0; // Patient-corrected = full confidence
                existingResults[qId].editedByPatient = true;
            }
            else {
                existingResults[qId] = {
                    answer,
                    confidence: 1.0,
                    editedByPatient: true,
                };
            }
        }
        // Spread to create a new reference so Sequelize detects JSONB change
        scan.scanResults = { ...existingResults };
        scan.doctorReviewed = false; // Reset review since answers changed
        scan.changed('scanResults', true);
        await scan.save();
        // Sync corrected answers to ScanLog
        if (scan.pageNumber) {
            const scanLogPageId = `backend_page_${scan.pageNumber}`;
            const scanData = {};
            for (const [qId, qResult] of Object.entries(existingResults)) {
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
                    doctorReviewed: false,
                });
            }
        }
        return this.enrichScanReportMetadata(scan, { reportUrlsMode: "urls" });
    }
    /**
     * Get doctor-prefilled question marks for a specific page (for patient app to show pre-filled checkboxes).
     * Returns the questionMarks from the latest doctor_manual record for this patient+page.
     */
    async getDoctorMarksForPage(patientId, pageNumber) {
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(patientId);
        const record = await BubbleScanResult_1.BubbleScanResult.findOne({
            where: { patientId, pageNumber, doctorReviewed: true },
            attributes: ["questionMarks"],
            order: [["createdAt", "DESC"]],
        });
        return record?.questionMarks ?? {};
    }
    /**
     * Doctor manually creates or updates an investigation report for a patient.
     * Used for pages with layoutType "investigation_summary" (pages 05 & 06).
     * Creates a new BubbleScanResult if none exists, or updates the existing one.
     */
    async doctorFillReport(patientId, doctorId, role, pageNumber, questionMarks, doctorNotes, questionSelections // select-type answers (e.g. surgery: "BCS")
    ) {
        const resolvedDoctorId = await this.resolveDoctorId(doctorId, role);
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(patientId);
        // Verify doctor has access to this patient
        const patient = await Patient_1.Patient.findByPk(patientId, { attributes: ["id", "doctorId", "caseType"] });
        if (!patient)
            throw new Error("Patient not found");
        const isCurrentDoctor = patient.doctorId === resolvedDoctorId;
        if (!isCurrentDoctor) {
            // Allow if old doctor (history check)
            const history = await DoctorPatientHistory_1.DoctorPatientHistory.findOne({
                where: { patientId, doctorId: resolvedDoctorId, unassignedAt: { [sequelize_1.Op.ne]: null } },
            });
            if (!history)
                throw new Error("Access denied: patient not assigned to this doctor");
        }
        // Resolve the DiaryPage for this pageNumber
        const resolvedDiaryType = (0, constants_1.getDiaryTypeForCaseType)(patient.caseType);
        const diaryPage = await DiaryPage_1.DiaryPage.findOne({
            where: { pageNumber, diaryType: resolvedDiaryType, isActive: true },
        });
        const pageId = `backend_page_${pageNumber}`;
        // Find existing BubbleScanResult for this patient + page
        const existing = await BubbleScanResult_1.BubbleScanResult.findOne({
            where: { patientId, pageNumber },
            order: [["createdAt", "DESC"]],
        });
        if (existing) {
            await existing.update({
                questionMarks,
                doctorNotes: doctorNotes ?? existing.doctorNotes,
                doctorOverrides: questionSelections ?? existing.doctorOverrides ?? {},
                doctorReviewed: true,
                reviewedBy: resolvedDoctorId,
                reviewedAt: new Date(),
                diaryPageId: diaryPage?.id ?? existing.diaryPageId,
            });
            return existing.reload({
                include: [
                    { model: DiaryPage_1.DiaryPage, as: "diaryPage", attributes: ["pageNumber", "layoutType", "questions"], required: false },
                ],
            });
        }
        // Create new doctor-initiated record
        const created = await BubbleScanResult_1.BubbleScanResult.create({
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
            reviewedBy: resolvedDoctorId,
            reviewedAt: new Date(),
            scannedAt: new Date(),
        });
        return created.reload({
            include: [
                { model: DiaryPage_1.DiaryPage, as: "diaryPage", attributes: ["pageNumber", "layoutType", "questions"], required: false },
            ],
        });
    }
    /**
     * Doctor dashboard: get all patients with their submission status for a specific diary page.
     * Enables filtering like "who uploaded Mammogram", "who hasn't submitted page 5", etc.
     *
     * GET /api/v1/bubble-scan/doctor/diary-filter?pageNumber=5&questionId=q1&filter=submitted
     */
    async getDiaryFilteredPatients(doctorId, role, options) {
        const { pageNumber, questionId, filter = "all" } = options;
        const resolvedDoctorId = await this.resolveDoctorId(doctorId, role);
        // 1. Collect current patients
        const currentPatients = await Patient_1.Patient.findAll({
            where: { doctorId: resolvedDoctorId },
            attributes: ["id", "fullName", "age", "gender", "stage"],
            raw: true,
        });
        const approvedCurrentPatientIds = await (0, diaryAccess_service_1.filterPatientsWithApprovedDiaries)(currentPatients.map((patient) => patient.id));
        const filteredCurrentPatients = currentPatients.filter((patient) => approvedCurrentPatientIds.has(patient.id));
        const currentPatientIds = filteredCurrentPatients.map((p) => p.id);
        const currentSet = new Set(currentPatientIds);
        // 2. Collect historical patients
        const historyRecords = await DoctorPatientHistory_1.DoctorPatientHistory.findAll({
            where: { doctorId: resolvedDoctorId, unassignedAt: { [sequelize_1.Op.ne]: null } },
            attributes: ["patientId", "unassignedAt"],
        });
        const historicalMap = new Map();
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
        const approvedHistoricalPatientIds = await (0, diaryAccess_service_1.filterPatientsWithApprovedDiaries)(historicalPatientIds);
        const historicalPatients = historicalPatientIds.length > 0
            ? await Patient_1.Patient.findAll({
                where: { id: { [sequelize_1.Op.in]: [...approvedHistoricalPatientIds] } },
                attributes: ["id", "fullName", "age", "gender", "stage"],
                raw: true,
            })
            : [];
        const allPatients = [...filteredCurrentPatients, ...historicalPatients];
        if (allPatients.length === 0) {
            return {
                pageNumber,
                summary: { total: 0, submitted: 0, notSubmitted: 0 },
                patients: [],
            };
        }
        const allPatientIds = allPatients.map((p) => p.id);
        // 3. Single query: latest scan per patient for this pageNumber
        const scans = await BubbleScanResult_1.BubbleScanResult.findAll({
            where: {
                patientId: { [sequelize_1.Op.in]: allPatientIds },
                pageNumber,
                processingStatus: "completed",
            },
            attributes: ["id", "patientId", "submissionType", "scanResults", "questionMarks", "scannedAt"],
            order: [["scannedAt", "DESC"]],
            raw: true,
        });
        // Build map: patientId -> latest scan (first due to DESC order)
        const scanMap = new Map();
        for (const scan of scans) {
            if (!scanMap.has(scan.patientId)) {
                scanMap.set(scan.patientId, scan);
            }
        }
        // 4. Build result rows
        const rows = allPatients.map((patient) => {
            const scan = scanMap.get(patient.id) ?? null;
            const submitted = scan !== null;
            let questionAnswer = null;
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
                }
                else if (marks[questionId] !== undefined) {
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
    async attachReports(scanId, patientId, files) {
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(patientId);
        const scan = await BubbleScanResult_1.BubbleScanResult.findOne({
            where: { id: scanId, patientId },
        });
        if (!scan)
            throw new AppError_1.AppError(404, "Scan entry not found");
        if (files.length === 0)
            throw new AppError_1.AppError(400, "No report files provided");
        const uploadedFiles = [];
        for (const file of files) {
            const key = (0, s3Upload_1.buildReportS3Key)(patientId, scanId, file.originalname, file.mimetype);
            const url = await (0, s3Upload_1.uploadBufferToS3)(file.buffer, file.mimetype, key);
            uploadedFiles.push({ url, name: file.originalname });
        }
        const existing = (0, reportFiles_1.normalizeReportFiles)(scan.reportUrls);
        scan.reportUrls = [...existing, ...uploadedFiles];
        scan.changed("reportUrls", true);
        await scan.save();
        return this.enrichScanReportMetadata(scan, { reportUrlsMode: "urls" });
    }
    /**
     * Remove a specific report URL from a scan entry (patient-initiated deletion).
     */
    async removeReport(scanId, patientId, reportUrl) {
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(patientId);
        const scan = await BubbleScanResult_1.BubbleScanResult.findOne({
            where: { id: scanId, patientId },
        });
        if (!scan)
            throw new AppError_1.AppError(404, "Scan entry not found");
        const existing = (0, reportFiles_1.normalizeReportFiles)(scan.reportUrls).map((file) => file.url);
        const updated = existing.filter((u) => u !== reportUrl);
        if (updated.length === existing.length) {
            throw new AppError_1.AppError(404, "Report URL not found on this scan entry");
        }
        scan.reportUrls = updated;
        scan.changed("reportUrls", true);
        await scan.save();
        return this.enrichScanReportMetadata(scan, { reportUrlsMode: "urls" });
    }
    /**
     * Attach report files to one or more questions in a single request.
     * pairs: [{ questionId, file }] — one entry per file.
     * Supports PDF, DOC, DOCX, and images.
     * Stored in questionReports: { "Q1": [{ url, name }], "Q2": [{ url, name }], ... }
     */
    async attachQuestionReports(scanId, patientId, pairs) {
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(patientId);
        const scan = await BubbleScanResult_1.BubbleScanResult.findOne({
            where: { id: scanId, patientId },
        });
        if (!scan)
            throw new AppError_1.AppError(404, "Scan entry not found");
        if (pairs.length === 0)
            throw new AppError_1.AppError(400, "No question-file pairs provided");
        const updated = { ...(scan.questionReports ?? {}) };
        for (const { questionId, file } of pairs) {
            const qid = questionId.trim();
            const key = (0, s3Upload_1.buildQuestionReportS3Key)(patientId, scanId, qid, file.originalname, file.mimetype);
            const url = await (0, s3Upload_1.uploadBufferToS3)(file.buffer, file.mimetype, key);
            const existing = Array.isArray(updated[qid]) ? (0, reportFiles_1.normalizeReportFiles)(updated[qid]) : [];
            updated[qid] = [...existing, { url, name: file.originalname }];
        }
        scan.questionReports = updated;
        scan.changed("questionReports", true);
        await scan.save();
        return this.enrichScanReportMetadata(scan, { reportUrlsMode: "urls" });
    }
    /**
     * Remove a specific report URL from a question in a scan entry.
     */
    async removeQuestionReport(scanId, patientId, questionId, reportUrl) {
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(patientId);
        const scan = await BubbleScanResult_1.BubbleScanResult.findOne({
            where: { id: scanId, patientId },
        });
        if (!scan)
            throw new AppError_1.AppError(404, "Scan entry not found");
        const existing = (scan.questionReports ?? {});
        const forQuestion = Array.isArray(existing[questionId]) ? existing[questionId] : [];
        const updated = forQuestion.filter((u) => (typeof u === "string" ? u : u.url) !== reportUrl);
        if (updated.length === forQuestion.length) {
            throw new AppError_1.AppError(404, "Report URL not found for this question");
        }
        const newMap = { ...existing };
        if (updated.length === 0) {
            delete newMap[questionId];
        }
        else {
            newMap[questionId] = updated;
        }
        scan.questionReports = newMap;
        scan.changed("questionReports", true);
        await scan.save();
        return this.enrichScanReportMetadata(scan, { reportUrlsMode: "urls" });
    }
}
exports.bubbleScanService = new BubbleScanService();
