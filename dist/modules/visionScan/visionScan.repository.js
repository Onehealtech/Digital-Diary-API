"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visionScanRepository = exports.VisionScanRepository = void 0;
const sequelize_1 = require("sequelize");
const BubbleScanResult_1 = require("../../models/BubbleScanResult");
const ScanLog_1 = require("../../models/ScanLog");
const Patient_1 = require("../../models/Patient");
const Appuser_1 = require("../../models/Appuser");
const DiaryPage_1 = require("../../models/DiaryPage");
const visionScan_types_1 = require("./visionScan.types");
class VisionScanRepository {
    async findDiaryPage(pageNumber, diaryType) {
        return DiaryPage_1.DiaryPage.findOne({
            where: { pageNumber, diaryType, isActive: true },
        });
    }
    async createScanRecord(data) {
        return BubbleScanResult_1.BubbleScanResult.create({
            patientId: data.patientId,
            pageId: `page-${data.pageNumber}`,
            pageNumber: data.pageNumber,
            diaryPageId: data.diaryPageId,
            submissionType: data.submissionType,
            imageUrl: data.imageUrl,
            processingStatus: data.processingStatus,
            scanResults: data.scanResults,
            scannedAt: new Date(),
        });
    }
    async updateScanCompleted(scan, data) {
        await scan.update({
            processingStatus: visionScan_types_1.ProcessingStatus.COMPLETED,
            scanResults: data.scanResults,
            rawConfidenceScores: data.rawConfidenceScores,
            processingMetadata: data.processingMetadata,
            flagged: data.flagged,
        });
    }
    async updateScanFailed(scan, errorMessage) {
        await scan.update({
            processingStatus: visionScan_types_1.ProcessingStatus.FAILED,
            errorMessage,
        });
    }
    async syncToScanLog(patientId, pageNumber, enrichedResults) {
        const scanLogPageId = `backend_page_${pageNumber}`;
        const scanData = {};
        for (const [qId, qResult] of Object.entries(enrichedResults)) {
            scanData[qId] = qResult.answer;
            if (qResult.questionText) {
                scanData[`${qId}_text`] = qResult.questionText;
            }
        }
        const [record, created] = await ScanLog_1.ScanLog.upsert({
            patientId,
            pageId: scanLogPageId,
            scanData,
            scannedAt: new Date(),
            isUpdated: true,
            updatedCount: 1,
        }, { returning: true });
        if (!created && record) {
            await record.update({
                updatedCount: record.updatedCount + 1,
            });
        }
    }
    async findScanById(scanId) {
        return BubbleScanResult_1.BubbleScanResult.findByPk(scanId);
    }
    async findScanByIdWithPatient(scanId) {
        return BubbleScanResult_1.BubbleScanResult.findByPk(scanId, {
            include: [
                {
                    model: Patient_1.Patient,
                    as: "patient",
                    attributes: ["id", "age", "gender", "stage"],
                },
            ],
        });
    }
    async deleteScan(scan) {
        await scan.destroy();
    }
    async findPatientCaseType(patientId) {
        const patient = await Patient_1.Patient.findByPk(patientId, {
            attributes: ["caseType"],
        });
        return patient?.caseType;
    }
    async getPatientScans(patientId, page, limit) {
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
     * Returns all distinct date strings (DD/MMM/YYYY) found in previous COMPLETED
     * scans for this patient + page, excluding the current scan being processed.
     */
    async findHistoricalDatesForPage(patientId, pageNumber, excludeScanId) {
        const where = { patientId, pageNumber, processingStatus: visionScan_types_1.ProcessingStatus.COMPLETED };
        if (excludeScanId)
            where.id = { [sequelize_1.Op.ne]: excludeScanId };
        const previous = await BubbleScanResult_1.BubbleScanResult.findAll({
            where,
            attributes: ["scanResults"],
            order: [["scannedAt", "DESC"]],
        });
        const dates = new Set();
        for (const scan of previous) {
            const results = scan.scanResults;
            if (!results)
                continue;
            for (const field of Object.values(results)) {
                if (field.answer && /^\d{2}\/[A-Za-z]{3}\/\d{4}$/.test(field.answer)) {
                    dates.add(field.answer);
                }
            }
        }
        return [...dates];
    }
    async resolveDoctorId(userId, role) {
        if (role === "ASSISTANT") {
            const assistant = await Appuser_1.AppUser.findByPk(userId);
            if (!assistant || !assistant.parentId) {
                throw new Error("Assistant not linked to a doctor");
            }
            return assistant.parentId;
        }
        return userId;
    }
    async getDoctorPatientScans(doctorId, role, filters) {
        const { page = 1, limit = 20, processingStatus, patientId, startDate, endDate, reviewed, flagged, } = filters;
        const offset = (page - 1) * limit;
        const resolvedDoctorId = await this.resolveDoctorId(doctorId, role);
        const whereClause = {};
        const patientWhere = {
            doctorId: resolvedDoctorId,
        };
        if (processingStatus)
            whereClause.processingStatus = processingStatus;
        if (patientId) {
            whereClause.patientId = patientId;
        }
        if (reviewed !== undefined)
            whereClause.doctorReviewed = reviewed;
        if (flagged !== undefined)
            whereClause.flagged = flagged;
        if (startDate || endDate) {
            const scannedAt = {};
            if (startDate)
                scannedAt[sequelize_1.Op.gte] = startDate;
            if (endDate)
                scannedAt[sequelize_1.Op.lte] = endDate;
            whereClause.scannedAt = scannedAt;
        }
        const { rows, count } = await BubbleScanResult_1.BubbleScanResult.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Patient_1.Patient,
                    as: "patient",
                    where: patientWhere,
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
    async updateScanReview(scan, doctorId, data) {
        const updateData = {
            doctorReviewed: true,
            reviewedBy: doctorId,
            reviewedAt: new Date(),
        };
        if (data.doctorNotes !== undefined)
            updateData.doctorNotes = data.doctorNotes;
        if (data.flagged !== undefined)
            updateData.flagged = data.flagged;
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
                currentResults[qId].confidence = 1.0;
            }
            updateData.doctorOverrides = existingOverrides;
            updateData.scanResults = currentResults;
        }
        await scan.update(updateData);
        return scan;
    }
}
exports.VisionScanRepository = VisionScanRepository;
exports.visionScanRepository = new VisionScanRepository();
