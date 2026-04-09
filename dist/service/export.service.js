"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportService = void 0;
const Export_1 = require("../models/Export");
const Patient_1 = require("../models/Patient");
const ScanLog_1 = require("../models/ScanLog");
const Appuser_1 = require("../models/Appuser");
const sequelize_1 = require("sequelize");
const patientAccess_service_1 = require("./patientAccess.service");
class ExportService {
    /**
     * Generate export for patient data
     * Returns export record, actual file generation happens async
     */
    async exportPatientData(data) {
        // Verify patient access
        const patient = await Patient_1.Patient.findByPk(data.patientId, {
            include: [
                {
                    model: Appuser_1.AppUser,
                    as: "doctor",
                    attributes: ["id", "fullName"],
                },
            ],
        });
        if (!patient) {
            throw new Error("Patient not found");
        }
        // Create export record
        const exportRecord = await Export_1.Export.create({
            userId: data.userId,
            type: "patient-data",
            patientId: data.patientId,
            format: data.format,
            downloadUrl: `/exports/patient-${data.patientId}-${Date.now()}.${data.format}`,
            fileSize: 0,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        });
        // In production, you would queue a job here to generate the actual file
        // For now, return the export record
        return {
            exportId: exportRecord.id,
            status: "pending",
            message: "Export queued for generation",
            expiresAt: exportRecord.expiresAt,
        };
    }
    /**
     * Export diary pages (images) as PDF or ZIP
     */
    async exportDiaryPages(data) {
        // Verify patient and get diary entries
        const whereClause = {
            patientId: data.patientId,
        };
        if (data.startDate || data.endDate) {
            whereClause.scannedAt = {};
            if (data.startDate) {
                whereClause.scannedAt[sequelize_1.Op.gte] = data.startDate;
            }
            if (data.endDate) {
                whereClause.scannedAt[sequelize_1.Op.lte] = data.endDate;
            }
        }
        const diaryEntries = await ScanLog_1.ScanLog.findAll({
            where: whereClause,
            order: [["scannedAt", "ASC"]],
        });
        if (diaryEntries.length === 0) {
            throw new Error("No diary entries found for this patient");
        }
        // Create export record
        const exportRecord = await Export_1.Export.create({
            userId: data.userId,
            type: "diary-pages",
            patientId: data.patientId,
            format: data.format,
            downloadUrl: `/exports/diary-pages-${data.patientId}-${Date.now()}.${data.format}`,
            fileSize: 0,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        // In production, queue job to:
        // - Collect all imageUrls from ScanLog
        // - If format is 'pdf': combine images into single PDF
        // - If format is 'zip': zip all images together
        // - Upload to cloud storage
        // - Update export record with actual download URL and file size
        return {
            exportId: exportRecord.id,
            status: "pending",
            message: `Export queued: ${diaryEntries.length} diary pages`,
            entriesCount: diaryEntries.length,
            expiresAt: exportRecord.expiresAt,
        };
    }
    /**
     * Export test summary for a patient
     */
    async exportTestSummary(data) {
        // Get patient with test data
        const patient = await Patient_1.Patient.findByPk(data.patientId, {
            include: [
                {
                    model: Appuser_1.AppUser,
                    as: "doctor",
                    attributes: ["id", "fullName", "email"],
                },
            ],
        });
        if (!patient) {
            throw new Error("Patient not found");
        }
        // Create export record
        const exportRecord = await Export_1.Export.create({
            userId: data.userId,
            type: "test-reports",
            patientId: data.patientId,
            format: data.format,
            downloadUrl: `/exports/tests-${data.patientId}-${Date.now()}.${data.format}`,
            fileSize: 0,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        // In production, generate:
        // - Patient details
        // - List of prescribed tests
        // - Completion status
        // - Test dates
        // - Completion percentage
        // Format as PDF or Excel
        return {
            exportId: exportRecord.id,
            status: "pending",
            message: "Test summary export queued",
            totalTests: patient.totalTestsPrescribed,
            completionPercentage: patient.testCompletionPercentage,
            expiresAt: exportRecord.expiresAt,
        };
    }
    /**
     * Get all exports for a user
     */
    async getUserExports(userId, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const { rows: exports, count: total } = await Export_1.Export.findAndCountAll({
            where: { userId },
            include: [
                {
                    model: Patient_1.Patient,
                    as: "patient",
                    attributes: ["id", "fullName", "phone"],
                },
            ],
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });
        return {
            exports,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Get export by ID
     */
    async getExportById(exportId, userId) {
        const exportRecord = await Export_1.Export.findOne({
            where: {
                id: exportId,
                userId,
            },
            include: [
                {
                    model: Patient_1.Patient,
                    as: "patient",
                    attributes: ["id", "fullName", "phone"],
                },
            ],
        });
        if (!exportRecord) {
            throw new Error("Export not found or access denied");
        }
        // Check if expired
        const now = new Date();
        if (exportRecord.expiresAt < now) {
            return {
                ...exportRecord.toJSON(),
                status: "expired",
                message: "This export has expired",
            };
        }
        return {
            ...exportRecord.toJSON(),
            status: "ready",
        };
    }
    /**
     * Delete export
     */
    async deleteExport(exportId, userId) {
        const exportRecord = await Export_1.Export.findOne({
            where: {
                id: exportId,
                userId,
            },
        });
        if (!exportRecord) {
            throw new Error("Export not found or access denied");
        }
        // In production, also delete the file from cloud storage
        await exportRecord.destroy();
        return {
            message: "Export deleted successfully",
        };
    }
    /**
     * Get patient analytics
     * Advanced analytics for a specific patient
     */
    async getPatientAnalytics(patientId, requesterId, role) {
        // Verify access
        let whereClause = { id: patientId };
        if (role === "DOCTOR") {
            whereClause.doctorId = requesterId;
        }
        else if (role === "ASSISTANT") {
            const scope = await (0, patientAccess_service_1.resolveAssistantPatientScope)({ id: requesterId, role });
            if (scope.allowedPatientIds && !scope.allowedPatientIds.includes(patientId)) {
                throw new Error("Patient not found or access denied");
            }
            whereClause.doctorId = scope.doctorId;
        }
        else {
            throw new Error("Unauthorized to view analytics");
        }
        const patient = await Patient_1.Patient.findOne({
            where: whereClause,
            include: [
                {
                    model: Appuser_1.AppUser,
                    as: "doctor",
                    attributes: ["id", "fullName", "email"],
                },
            ],
        });
        if (!patient) {
            throw new Error("Patient not found or access denied");
        }
        // Get diary entry statistics
        const totalEntries = await ScanLog_1.ScanLog.count({
            where: { patientId },
        });
        const reviewedEntries = await ScanLog_1.ScanLog.count({
            where: {
                patientId,
                doctorReviewed: true,
            },
        });
        const flaggedEntries = await ScanLog_1.ScanLog.count({
            where: {
                patientId,
                flagged: true,
            },
        });
        // Entries by page type
        const entriesByType = await ScanLog_1.ScanLog.findAll({
            where: { patientId },
            attributes: [
                "pageType",
                [ScanLog_1.ScanLog.sequelize.fn("COUNT", "*"), "count"],
            ],
            group: ["pageType"],
            raw: true,
        });
        // Timeline data (entries per week for last 12 weeks)
        const twelveWeeksAgo = new Date();
        twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
        const recentEntries = await ScanLog_1.ScanLog.findAll({
            where: {
                patientId,
                scannedAt: { [sequelize_1.Op.gte]: twelveWeeksAgo },
            },
            order: [["scannedAt", "ASC"]],
            attributes: ["scannedAt", "pageType"],
        });
        // Test completion timeline
        const prescribedTests = patient.prescribedTests || [];
        const completedTests = prescribedTests.filter((t) => t.completed);
        const testsWithReports = prescribedTests.filter((t) => t.reportReceived);
        return {
            patient: {
                id: patient.id,
                name: patient.fullName,
                age: patient.age,
                gender: patient.gender,
                stage: patient.stage,
                diaryType: patient.diaryType,
                registeredDate: patient.registeredDate,
            },
            diaryStats: {
                totalEntries,
                reviewedEntries,
                flaggedEntries,
                unreviewedEntries: totalEntries - reviewedEntries,
                reviewCompletionRate: totalEntries > 0 ? Math.round((reviewedEntries / totalEntries) * 100) : 0,
                entriesByType,
            },
            testProgress: {
                totalPrescribed: patient.totalTestsPrescribed,
                completed: completedTests.length,
                reportsReceived: testsWithReports.length,
                completionPercentage: patient.testCompletionPercentage,
                prescribedTests,
            },
            timeline: {
                recentEntries,
                firstEntry: recentEntries.length > 0 ? recentEntries[0] : null,
                lastEntry: recentEntries.length > 0 ? recentEntries[recentEntries.length - 1] : null,
            },
            engagement: {
                lastDiaryScan: patient.lastDiaryScan,
                lastDoctorContact: patient.lastDoctorContact,
                daysSinceLastScan: patient.lastDiaryScan
                    ? Math.floor((Date.now() - patient.lastDiaryScan.getTime()) / (1000 * 60 * 60 * 24))
                    : null,
                daysSinceLastContact: patient.lastDoctorContact
                    ? Math.floor((Date.now() - patient.lastDoctorContact.getTime()) / (1000 * 60 * 60 * 24))
                    : null,
            },
        };
    }
    /**
     * Clean up expired exports (should be run as cron job)
     */
    async cleanupExpiredExports() {
        const now = new Date();
        const expiredExports = await Export_1.Export.findAll({
            where: {
                expiresAt: { [sequelize_1.Op.lt]: now },
            },
        });
        // In production, delete files from cloud storage first
        await Export_1.Export.destroy({
            where: {
                expiresAt: { [sequelize_1.Op.lt]: now },
            },
        });
        return {
            message: `Cleaned up ${expiredExports.length} expired exports`,
            count: expiredExports.length,
        };
    }
}
exports.exportService = new ExportService();
