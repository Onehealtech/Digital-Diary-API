import { ScanLog } from "../models/ScanLog";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { DoctorPatientHistory } from "../models/DoctorPatientHistory";
import { Op } from "sequelize";

interface DiaryEntryFilters {
  page?: number;
  limit?: number;
  pageType?: string;
  reviewed?: boolean;
  flagged?: boolean;
  patientId?: string;
  startDate?: Date;
  endDate?: Date;
}

interface ReviewData {
  doctorNotes?: string;
  flagged?: boolean;
}

class ScanService {
  /**
   * Resolve doctorId from requester based on role
   */
  private async resolveDoctorId(requesterId: string, role: string): Promise<string> {
    if (role === "ASSISTANT") {
      const assistant = await AppUser.findByPk(requesterId);
      if (!assistant || !assistant.parentId) {
        throw new Error("Assistant not linked to a doctor");
      }
      return assistant.parentId;
    } else if (role !== "DOCTOR") {
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
  private async getDateCutoff(
    patientId: string,
    doctorId: string
  ): Promise<Date | null> {
    const patient = await Patient.findByPk(patientId, { attributes: ["doctorId"] });
    if (patient && patient.doctorId === doctorId) {
      return null; // current doctor — full access
    }

    // Check history for old doctor
    const history = await DoctorPatientHistory.findOne({
      where: { patientId, doctorId, unassignedAt: { [Op.ne]: null } },
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
  private async resolveAccessiblePatients(doctorId: string): Promise<{
    currentPatientIds: string[];
    historicalPatients: { patientId: string; cutoffDate: Date }[];
  }> {
    // Current patients
    const currentPatients = await Patient.findAll({
      where: { doctorId },
      attributes: ["id"],
      raw: true,
    });
    const currentPatientIds = currentPatients.map((p: any) => p.id);

    // Historical patients (transferred away)
    const historyRecords = await DoctorPatientHistory.findAll({
      where: { doctorId, unassignedAt: { [Op.ne]: null } },
      attributes: ["patientId", "unassignedAt"],
    });

    // Deduplicate: use latest unassignedAt per patient, exclude current patients
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

    const historicalPatients = Array.from(historicalMap.entries()).map(
      ([patientId, cutoffDate]) => ({ patientId, cutoffDate })
    );

    return { currentPatientIds, historicalPatients };
  }

  /**
   * Get all diary entries for doctor/assistant
   * With filtering and pagination.
   * Old doctors only see entries up to the time the patient was with them.
   * New/current doctors see ALL entries from start.
   */
  async getAllDiaryEntries(
    requesterId: string,
    role: string,
    filters: DiaryEntryFilters = {}
  ) {
    const {
      page = 1,
      limit = 20,
      pageType,
      reviewed,
      flagged,
      patientId,
      startDate,
      endDate,
    } = filters;

    const offset = (page - 1) * limit;

    const doctorId = await this.resolveDoctorId(requesterId, role);

    // Build where clause for ScanLog
    const whereClause: any = {};

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
        whereClause.scannedAt[Op.gte] = startDate;
      }
      if (endDate) {
        whereClause.scannedAt[Op.lte] = endDate;
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
          [Op.lte]: cutoff,
        };
      }

      // No patient.doctorId filter needed — we validated access via getDateCutoff
      const { rows: entries, count: total } = await ScanLog.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Patient,
            as: "patient",
            required: true,
            attributes: ["id", "fullName", "phone", "age", "gender", "stage", "diaryId"],
          },
        ],
        order: [["scannedAt", "DESC"]],
        limit,
        offset,
      });

      const unreviewed = await ScanLog.count({
        where: { ...whereClause, doctorReviewed: false },
        include: [{ model: Patient, as: "patient", required: true, attributes: [] }],
      });

      const flaggedCount = await ScanLog.count({
        where: { ...whereClause, flagged: true },
        include: [{ model: Patient, as: "patient", required: true, attributes: [] }],
      });

      return {
        entries,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        stats: { unreviewed, flagged: flaggedCount },
      };
    }

    // No specific patient — get all accessible patients with date constraints
    const { currentPatientIds, historicalPatients } =
      await this.resolveAccessiblePatients(doctorId);

    // Build OR conditions: current patients (all data) + historical patients (up to cutoff each)
    const patientConditions: any[] = [];

    if (currentPatientIds.length > 0) {
      patientConditions.push({ patientId: { [Op.in]: currentPatientIds } });
    }

    for (const hp of historicalPatients) {
      patientConditions.push({
        patientId: hp.patientId,
        scannedAt: { [Op.lte]: hp.cutoffDate },
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
      [Op.or]: patientConditions,
    };

    const { rows: entries, count: total } = await ScanLog.findAndCountAll({
      where: finalWhere,
      include: [
        {
          model: Patient,
          as: "patient",
          required: true,
          attributes: ["id", "fullName", "phone", "age", "gender", "stage", "diaryId"],
        },
      ],
      order: [["scannedAt", "DESC"]],
      limit,
      offset,
    });

    const unreviewed = await ScanLog.count({
      where: { ...finalWhere, doctorReviewed: false },
      include: [{ model: Patient, as: "patient", required: true, attributes: [] }],
    });

    const flaggedCount = await ScanLog.count({
      where: { ...finalWhere, flagged: true },
      include: [{ model: Patient, as: "patient", required: true, attributes: [] }],
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
  async getDiaryEntryById(entryId: string, requesterId: string, role: string) {
    const doctorId = await this.resolveDoctorId(requesterId, role);

    const entry = await ScanLog.findOne({
      where: { id: entryId },
      include: [
        {
          model: Patient,
          as: "patient",
          required: true,
          attributes: ["id", "fullName", "phone", "age", "gender", "stage", "diaryId", "caseType", "doctorId"],
        },
      ],
    });

    if (!entry) {
      throw new Error("Diary entry not found or access denied");
    }

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
  async reviewDiaryEntry(
    entryId: string,
    doctorId: string,
    reviewData: ReviewData
  ) {
    const entry = await ScanLog.findOne({
      where: { id: entryId },
      include: [
        {
          model: Patient,
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
   * Flag/unflag a diary entry.
   * Only the current doctor can flag entries.
   */
  async toggleFlag(entryId: string, doctorId: string, flagged: boolean) {
    const entry = await ScanLog.findOne({
      where: { id: entryId },
      include: [
        {
          model: Patient,
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
   * Get diary entries that need review (unreviewed + flagged).
   * Only shows entries from current patients (not historical).
   */
  async getEntriesNeedingReview(doctorId: string) {
    const patientInclude = {
      model: Patient,
      as: "patient",
      where: { doctorId },
      required: true as const,
      attributes: ["id", "fullName", "phone", "diaryId"],
    };

    const unreviewedEntries = await ScanLog.findAll({
      where: { doctorReviewed: false },
      include: [patientInclude],
      order: [["scannedAt", "ASC"]],
      limit: 50,
    });

    const flaggedEntries = await ScanLog.findAll({
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
  async getDiaryEntryStats(doctorId: string) {
    const { currentPatientIds, historicalPatients } =
      await this.resolveAccessiblePatients(doctorId);

    // Build OR conditions for accessible scan logs
    const patientConditions: any[] = [];
    if (currentPatientIds.length > 0) {
      patientConditions.push({ patientId: { [Op.in]: currentPatientIds } });
    }
    for (const hp of historicalPatients) {
      patientConditions.push({
        patientId: hp.patientId,
        scannedAt: { [Op.lte]: hp.cutoffDate },
      });
    }

    if (patientConditions.length === 0) {
      return { total: 0, reviewed: 0, unreviewed: 0, flagged: 0, thisWeek: 0, byPageType: [] };
    }

    const accessWhere = { [Op.or]: patientConditions };

    const total = await ScanLog.count({ where: accessWhere });

    const reviewed = await ScanLog.count({
      where: { ...accessWhere, doctorReviewed: true },
    });

    const unreviewed = total - reviewed;

    const flagged = await ScanLog.count({
      where: { ...accessWhere, flagged: true },
    });

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const thisWeek = await ScanLog.count({
      where: { ...accessWhere, scannedAt: { [Op.gte]: oneWeekAgo } },
    });

    // Entries by page type
    const allPatientIds = [
      ...currentPatientIds,
      ...historicalPatients.map((hp) => hp.patientId),
    ];

    const byPageType = await ScanLog.findAll({
      where: { patientId: { [Op.in]: allPatientIds } },
      attributes: [
        "pageType",
        [ScanLog.sequelize!.fn("COUNT", "*"), "count"],
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

export const scanService = new ScanService();