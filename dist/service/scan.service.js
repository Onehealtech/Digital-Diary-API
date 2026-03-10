"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanService = void 0;
const ScanLog_1 = require("../models/ScanLog");
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const sequelize_1 = require("sequelize");
class ScanService {
    /**
     * Resolve doctorId from requester based on role
     */
    async resolveDoctorId(requesterId, role) {
        if (role === "ASSISTANT") {
            const assistant = await Appuser_1.AppUser.findByPk(requesterId);
            if (!assistant || !assistant.parentId) {
                throw new Error("Assistant not linked to a doctor");
            }
            return assistant.parentId;
        }
        else if (role !== "DOCTOR") {
            throw new Error("Only doctors and assistants can view diary entries");
        }
        return requesterId;
    }
    /**
     * Get all diary entries for doctor/assistant
     * With filtering and pagination
     */
    async getAllDiaryEntries(requesterId, role, filters = {}) {
        const { page = 1, limit = 20, pageType, reviewed, flagged, patientId, startDate, endDate, } = filters;
        const offset = (page - 1) * limit;
        const doctorId = await this.resolveDoctorId(requesterId, role);
        // Build where clause for ScanLog (no doctorId here — it's on Patient)
        const whereClause = {};
        if (pageType) {
            whereClause.pageType = pageType;
        }
        if (reviewed !== undefined) {
            whereClause.doctorReviewed = reviewed;
        }
        if (flagged !== undefined) {
            whereClause.flagged = flagged;
        }
        if (patientId) {
            whereClause.patientId = patientId;
        }
        if (startDate || endDate) {
            whereClause.scannedAt = {};
            if (startDate) {
                whereClause.scannedAt[sequelize_1.Op.gte] = startDate;
            }
            if (endDate) {
                whereClause.scannedAt[sequelize_1.Op.lte] = endDate;
            }
        }
        const { rows: entries, count: total } = await ScanLog_1.ScanLog.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Patient_1.Patient,
                    as: "patient",
                    where: { doctorId },
                    required: true,
                    attributes: ["id", "fullName", "phone", "age", "gender", "stage", "diaryId"],
                },
            ],
            order: [["scannedAt", "DESC"]],
            limit,
            offset,
        });
        // Get summary stats (filter through Patient join)
        const unreviewed = await ScanLog_1.ScanLog.count({
            where: { doctorReviewed: false },
            include: [
                {
                    model: Patient_1.Patient,
                    as: "patient",
                    where: { doctorId },
                    required: true,
                    attributes: [],
                },
            ],
        });
        const flaggedCount = await ScanLog_1.ScanLog.count({
            where: { flagged: true },
            include: [
                {
                    model: Patient_1.Patient,
                    as: "patient",
                    where: { doctorId },
                    required: true,
                    attributes: [],
                },
            ],
        });
        return {
            entries,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
            stats: {
                unreviewed,
                flagged: flaggedCount,
            },
        };
    }
    /**
     * Get single diary entry by ID
     */
    async getDiaryEntryById(entryId, requesterId, role) {
        const doctorId = await this.resolveDoctorId(requesterId, role);
        const entry = await ScanLog_1.ScanLog.findOne({
            where: { id: entryId },
            include: [
                {
                    model: Patient_1.Patient,
                    as: "patient",
                    where: { doctorId },
                    required: true,
                    attributes: ["id", "fullName", "phone", "age", "gender", "stage", "diaryId", "caseType"],
                },
            ],
        });
        if (!entry) {
            throw new Error("Diary entry not found or access denied");
        }
        return entry;
    }
    /**
     * Mark diary entry as reviewed by doctor
     */
    async reviewDiaryEntry(entryId, doctorId, reviewData) {
        const entry = await ScanLog_1.ScanLog.findOne({
            where: { id: entryId },
            include: [
                {
                    model: Patient_1.Patient,
                    as: "patient",
                    where: { doctorId },
                    required: true,
                    attributes: [],
                },
            ],
        });
        if (!entry) {
            throw new Error("Diary entry not found or access denied");
        }
        await entry.update({
            doctorReviewed: true,
            reviewedBy: doctorId,
            reviewedAt: new Date(),
            doctorNotes: reviewData.doctorNotes,
            flagged: reviewData.flagged !== undefined ? reviewData.flagged : entry.flagged,
        });
        return entry;
    }
    /**
     * Flag/unflag a diary entry
     */
    async toggleFlag(entryId, doctorId, flagged) {
        const entry = await ScanLog_1.ScanLog.findOne({
            where: { id: entryId },
            include: [
                {
                    model: Patient_1.Patient,
                    as: "patient",
                    where: { doctorId },
                    required: true,
                    attributes: [],
                },
            ],
        });
        if (!entry) {
            throw new Error("Diary entry not found or access denied");
        }
        await entry.update({ flagged });
        return entry;
    }
    /**
     * Get diary entries that need review (unreviewed + flagged)
     */
    async getEntriesNeedingReview(doctorId) {
        const patientInclude = {
            model: Patient_1.Patient,
            as: "patient",
            where: { doctorId },
            required: true,
            attributes: ["id", "fullName", "phone", "diaryId"],
        };
        const unreviewedEntries = await ScanLog_1.ScanLog.findAll({
            where: { doctorReviewed: false },
            include: [patientInclude],
            order: [["scannedAt", "ASC"]],
            limit: 50,
        });
        const flaggedEntries = await ScanLog_1.ScanLog.findAll({
            where: { flagged: true },
            include: [patientInclude],
            order: [["scannedAt", "DESC"]],
            limit: 20,
        });
        return {
            unreviewed: unreviewedEntries,
            flagged: flaggedEntries,
        };
    }
    /**
     * Get diary entry statistics for a doctor
     */
    async getDiaryEntryStats(doctorId) {
        const patientInclude = {
            model: Patient_1.Patient,
            as: "patient",
            where: { doctorId },
            required: true,
            attributes: [],
        };
        const total = await ScanLog_1.ScanLog.count({
            include: [patientInclude],
        });
        const reviewed = await ScanLog_1.ScanLog.count({
            where: { doctorReviewed: true },
            include: [patientInclude],
        });
        const unreviewed = total - reviewed;
        const flagged = await ScanLog_1.ScanLog.count({
            where: { flagged: true },
            include: [patientInclude],
        });
        // This week's entries
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const thisWeek = await ScanLog_1.ScanLog.count({
            where: {
                scannedAt: { [sequelize_1.Op.gte]: oneWeekAgo },
            },
            include: [patientInclude],
        });
        // Entries by page type — get patient IDs first to avoid GROUP BY join issues
        const doctorPatients = await Patient_1.Patient.findAll({
            where: { doctorId },
            attributes: ["id"],
            raw: true,
        });
        const doctorPatientIds = doctorPatients.map((p) => p.id);
        const byPageType = await ScanLog_1.ScanLog.findAll({
            where: { patientId: { [sequelize_1.Op.in]: doctorPatientIds } },
            attributes: [
                "pageType",
                [ScanLog_1.ScanLog.sequelize.fn("COUNT", "*"), "count"],
            ],
            group: ["pageType"],
            raw: true,
        });
        return {
            total,
            reviewed,
            unreviewed,
            flagged,
            thisWeek,
            byPageType,
        };
    }
}
exports.scanService = new ScanService();
