"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanService = void 0;
const ScanLog_1 = require("../models/ScanLog");
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const DoctorPatientHistory_1 = require("../models/DoctorPatientHistory");
const sequelize_1 = require("sequelize");
const diaryAccess_service_1 = require("./diaryAccess.service");
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
     * Get the date cutoff for a doctor viewing a specific patient.
     * - Current doctor (patient.doctorId === doctorId): null (no cutoff — see all data)
     * - Old doctor (has history with unassignedAt): unassignedAt (see data only up to that date)
     * - No relationship: throws access denied
     */
    async getDateCutoff(patientId, doctorId) {
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(patientId);
        const patient = await Patient_1.Patient.findByPk(patientId, { attributes: ["doctorId"] });
        if (patient && patient.doctorId === doctorId) {
            return null; // current doctor — full access
        }
        // Check history for old doctor
        const history = await DoctorPatientHistory_1.DoctorPatientHistory.findOne({
            where: { patientId, doctorId, unassignedAt: { [sequelize_1.Op.ne]: null } },
            order: [["unassignedAt", "DESC"]],
        });
        if (history && history.unassignedAt) {
            return history.unassignedAt;
        }
        throw new Error("Diary entry not found or access denied");
    }
    /**
     * Build patient IDs and scan date constraints for a doctor.
     * Returns { currentPatientIds, historicalPatients: [{patientId, cutoffDate}] }
     */
    async resolveAccessiblePatients(doctorId) {
        // Current patients
        const currentPatients = await Patient_1.Patient.findAll({
            where: { doctorId },
            attributes: ["id"],
            raw: true,
        });
        const approvedCurrentPatientIds = await (0, diaryAccess_service_1.filterPatientsWithApprovedDiaries)(currentPatients.map((p) => p.id));
        const currentPatientIds = currentPatients
            .map((p) => p.id)
            .filter((patientId) => approvedCurrentPatientIds.has(patientId));
        // Historical patients (transferred away)
        const historyRecords = await DoctorPatientHistory_1.DoctorPatientHistory.findAll({
            where: { doctorId, unassignedAt: { [sequelize_1.Op.ne]: null } },
            attributes: ["patientId", "unassignedAt"],
        });
        // Deduplicate: use latest unassignedAt per patient, exclude current patients
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
        const historicalPatients = Array.from(historicalMap.entries())
            .filter(([patientId]) => approvedHistoricalPatientIds.has(patientId))
            .map(([patientId, cutoffDate]) => ({ patientId, cutoffDate }));
        return { currentPatientIds, historicalPatients };
    }
    /**
     * Get all diary entries for doctor/assistant
     * With filtering and pagination.
     * Old doctors only see entries up to the time the patient was with them.
     * New/current doctors see ALL entries from start.
     */
    async getAllDiaryEntries(requesterId, role, filters = {}) {
        const { page = 1, limit = 20, pageType, reviewed, flagged, patientId, startDate, endDate, } = filters;
        const offset = (page - 1) * limit;
        const doctorId = await this.resolveDoctorId(requesterId, role);
        // Build where clause for ScanLog
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
        if (startDate || endDate) {
            whereClause.scannedAt = {};
            if (startDate) {
                whereClause.scannedAt[sequelize_1.Op.gte] = startDate;
            }
            if (endDate) {
                whereClause.scannedAt[sequelize_1.Op.lte] = endDate;
            }
        }
        // If filtering by specific patient, apply date cutoff for old doctors
        if (patientId) {
            whereClause.patientId = patientId;
            const cutoff = await this.getDateCutoff(patientId, doctorId);
            if (cutoff) {
                // Old doctor — restrict to data up to cutoff
                whereClause.scannedAt = {
                    ...(whereClause.scannedAt || {}),
                    [sequelize_1.Op.lte]: cutoff,
                };
            }
            // No patient.doctorId filter needed — we validated access via getDateCutoff
            const { rows: entries, count: total } = await ScanLog_1.ScanLog.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: Patient_1.Patient,
                        as: "patient",
                        required: true,
                        attributes: ["id", "fullName", "phone", "age", "gender", "stage", "diaryId"],
                    },
                ],
                order: [["scannedAt", "DESC"]],
                limit,
                offset,
            });
            const unreviewed = await ScanLog_1.ScanLog.count({
                where: { ...whereClause, doctorReviewed: false },
                include: [{ model: Patient_1.Patient, as: "patient", required: true, attributes: [] }],
            });
            const flaggedCount = await ScanLog_1.ScanLog.count({
                where: { ...whereClause, flagged: true },
                include: [{ model: Patient_1.Patient, as: "patient", required: true, attributes: [] }],
            });
            return {
                entries,
                pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
                stats: { unreviewed, flagged: flaggedCount },
            };
        }
        // No specific patient — get all accessible patients with date constraints
        const { currentPatientIds, historicalPatients } = await this.resolveAccessiblePatients(doctorId);
        // Build OR conditions: current patients (all data) + historical patients (up to cutoff each)
        const patientConditions = [];
        if (currentPatientIds.length > 0) {
            patientConditions.push({ patientId: { [sequelize_1.Op.in]: currentPatientIds } });
        }
        for (const hp of historicalPatients) {
            patientConditions.push({
                patientId: hp.patientId,
                scannedAt: { [sequelize_1.Op.lte]: hp.cutoffDate },
            });
        }
        if (patientConditions.length === 0) {
            return {
                entries: [],
                pagination: { total: 0, page, limit, totalPages: 0 },
                stats: { unreviewed: 0, flagged: 0 },
            };
        }
        // Merge with existing whereClause
        const finalWhere = {
            ...whereClause,
            [sequelize_1.Op.or]: patientConditions,
        };
        const { rows: entries, count: total } = await ScanLog_1.ScanLog.findAndCountAll({
            where: finalWhere,
            include: [
                {
                    model: Patient_1.Patient,
                    as: "patient",
                    required: true,
                    attributes: ["id", "fullName", "phone", "age", "gender", "stage", "diaryId"],
                },
            ],
            order: [["scannedAt", "DESC"]],
            limit,
            offset,
        });
        const unreviewed = await ScanLog_1.ScanLog.count({
            where: { ...finalWhere, doctorReviewed: false },
            include: [{ model: Patient_1.Patient, as: "patient", required: true, attributes: [] }],
        });
        const flaggedCount = await ScanLog_1.ScanLog.count({
            where: { ...finalWhere, flagged: true },
            include: [{ model: Patient_1.Patient, as: "patient", required: true, attributes: [] }],
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
     * Get single diary entry by ID.
     * Old doctor can only see entries up to their unassignment date.
     */
    async getDiaryEntryById(entryId, requesterId, role) {
        const doctorId = await this.resolveDoctorId(requesterId, role);
        const entry = await ScanLog_1.ScanLog.findOne({
            where: { id: entryId },
            include: [
                {
                    model: Patient_1.Patient,
                    as: "patient",
                    required: true,
                    attributes: ["id", "fullName", "phone", "age", "gender", "stage", "diaryId", "caseType", "doctorId"],
                },
            ],
        });
        if (!entry) {
            throw new Error("Diary entry not found or access denied");
        }
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(entry.patientId);
        // Verify access and date cutoff
        const cutoff = await this.getDateCutoff(entry.patientId, doctorId);
        if (cutoff && entry.scannedAt > cutoff) {
            throw new Error("Diary entry not found or access denied");
        }
        return entry;
    }
    /**
     * Mark diary entry as reviewed by doctor.
     * Only the current doctor can review entries.
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
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(entry.patientId);
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
     * Flag/unflag a diary entry.
     * Only the current doctor can flag entries.
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
        await (0, diaryAccess_service_1.assertApprovedDiaryAccess)(entry.patientId);
        await entry.update({ flagged });
        return entry;
    }
    /**
     * Get diary entries that need review (unreviewed + flagged).
     * Only shows entries from current patients (not historical).
     */
    async getEntriesNeedingReview(doctorId) {
        const approvedPatientIds = await (0, diaryAccess_service_1.filterPatientsWithApprovedDiaries)((await Patient_1.Patient.findAll({
            where: { doctorId },
            attributes: ["id"],
            raw: true,
        })).map((patient) => patient.id));
        const visiblePatientIds = [...approvedPatientIds];
        if (visiblePatientIds.length === 0) {
            return {
                unreviewed: [],
                flagged: [],
            };
        }
        const patientInclude = {
            model: Patient_1.Patient,
            as: "patient",
            where: { doctorId, id: { [sequelize_1.Op.in]: visiblePatientIds } },
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
     * Get diary entry statistics for a doctor.
     * Includes current patients (all data) + historical patients (up to cutoff).
     */
    async getDiaryEntryStats(doctorId) {
        const { currentPatientIds, historicalPatients } = await this.resolveAccessiblePatients(doctorId);
        // Build OR conditions for accessible scan logs
        const patientConditions = [];
        if (currentPatientIds.length > 0) {
            patientConditions.push({ patientId: { [sequelize_1.Op.in]: currentPatientIds } });
        }
        for (const hp of historicalPatients) {
            patientConditions.push({
                patientId: hp.patientId,
                scannedAt: { [sequelize_1.Op.lte]: hp.cutoffDate },
            });
        }
        if (patientConditions.length === 0) {
            return { total: 0, reviewed: 0, unreviewed: 0, flagged: 0, thisWeek: 0, byPageType: [] };
        }
        const accessWhere = { [sequelize_1.Op.or]: patientConditions };
        const total = await ScanLog_1.ScanLog.count({ where: accessWhere });
        const reviewed = await ScanLog_1.ScanLog.count({
            where: { ...accessWhere, doctorReviewed: true },
        });
        const unreviewed = total - reviewed;
        const flagged = await ScanLog_1.ScanLog.count({
            where: { ...accessWhere, flagged: true },
        });
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const thisWeek = await ScanLog_1.ScanLog.count({
            where: { ...accessWhere, scannedAt: { [sequelize_1.Op.gte]: oneWeekAgo } },
        });
        // Entries by page type
        const allPatientIds = [
            ...currentPatientIds,
            ...historicalPatients.map((hp) => hp.patientId),
        ];
        const byPageType = await ScanLog_1.ScanLog.findAll({
            where: { patientId: { [sequelize_1.Op.in]: allPatientIds } },
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
