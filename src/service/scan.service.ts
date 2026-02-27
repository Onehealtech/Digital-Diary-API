import { ScanLog } from "../models/ScanLog";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
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
   * Get all diary entries for doctor/assistant
   * With filtering and pagination
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

    // Build where clause for ScanLog
    const whereClause: any = {};

    // Get doctor ID based on role
    let doctorId = requesterId;
    if (role === "ASSISTANT") {
      const assistant = await AppUser.findByPk(requesterId);
      if (!assistant || !assistant.parentId) {
        throw new Error("Assistant not linked to a doctor");
      }
      doctorId = assistant.parentId;
    } else if (role !== "DOCTOR") {
      throw new Error("Only doctors and assistants can view diary entries");
    }

    // NOTE: ScanLog has no doctorId column — filter via Patient.doctorId join
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
        whereClause.scannedAt[Op.gte] = startDate;
      }
      if (endDate) {
        whereClause.scannedAt[Op.lte] = endDate;
      }
    }

    const { rows: entries, count: total } = await ScanLog.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "fullName", "phone", "age", "gender", "stage"],
          where: { doctorId },   // ← Filter by doctor through Patient join
          required: true,
        },
      ],
      order: [["scannedAt", "DESC"]],
      limit,
      offset,
    });

    // Get summary stats — filter through Patient join
    const unreviewedPatients = await Patient.findAll({ where: { doctorId }, attributes: ["id"], raw: true });
    const patientIds = unreviewedPatients.map((p: any) => p.id);

    const unreviewed = await ScanLog.count({
      where: {
        doctorReviewed: false,
        patientId: { [Op.in]: patientIds },
      },
    });

    const flaggedCount = await ScanLog.count({
      where: {
        flagged: true,
        patientId: { [Op.in]: patientIds },
      },
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
  async getDiaryEntryById(entryId: string, requesterId: string, role: string) {
    let doctorId = requesterId;
    if (role === "ASSISTANT") {
      const assistant = await AppUser.findByPk(requesterId);
      if (!assistant || !assistant.parentId) {
        throw new Error("Assistant not linked to a doctor");
      }
      doctorId = assistant.parentId;
    }

    const entry = await ScanLog.findOne({
      where: { id: entryId },
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "name", "phoneNumber", "age", "gender", "stage", "diaryType"],
          where: { doctorId },   // ← Scope to this doctor's patients
          required: true,
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
  async reviewDiaryEntry(
    entryId: string,
    doctorId: string,
    reviewData: ReviewData
  ) {
    // Verify the entry belongs to this doctor's patient
    const entryToReview = await ScanLog.findOne({
      where: { id: entryId },
      include: [{ model: Patient, as: "patient", where: { doctorId }, required: true, attributes: ["id"] }],
    });

    if (!entryToReview) {
      throw new Error("Diary entry not found or access denied");
    }

    await entryToReview.update({
      doctorReviewed: true,
      reviewedBy: doctorId,
      reviewedAt: new Date(),
      doctorNotes: reviewData.doctorNotes,
      flagged: reviewData.flagged !== undefined ? reviewData.flagged : entryToReview.flagged,
    });

    return entryToReview;
  }

  /**
   * Flag/unflag a diary entry
   */
  async toggleFlag(entryId: string, doctorId: string, flagged: boolean) {
    const entry = await ScanLog.findOne({
      where: { id: entryId },
      include: [{ model: Patient, as: "patient", where: { doctorId }, required: true, attributes: ["id"] }],
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
  async getEntriesNeedingReview(doctorId: string) {
    const unreviewedEntries = await ScanLog.findAll({
      where: { doctorReviewed: false },
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "name", "phoneNumber"],
          where: { doctorId },
          required: true,
        },
      ],
      order: [["scannedAt", "ASC"]], // Oldest first
      limit: 50,
    });

    const flaggedEntries = await ScanLog.findAll({
      where: { flagged: true },
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "name", "phoneNumber"],
          where: { doctorId },
          required: true,
        },
      ],
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
  async getDiaryEntryStats(doctorId: string) {
    // Get all patient IDs for this doctor
    const doctorPatients = await Patient.findAll({ where: { doctorId }, attributes: ["id"], raw: true });
    const patientIds = doctorPatients.map((p: any) => p.id);

    if (patientIds.length === 0) {
      return { total: 0, reviewed: 0, unreviewed: 0, flagged: 0, thisWeek: 0, byPageType: [] };
    }

    const patientFilter = { patientId: { [Op.in]: patientIds } };

    const total = await ScanLog.count({ where: patientFilter });
    const reviewed = await ScanLog.count({ where: { ...patientFilter, doctorReviewed: true } });
    const unreviewed = total - reviewed;
    const flagged = await ScanLog.count({ where: { ...patientFilter, flagged: true } });

    // This week's entries
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeek = await ScanLog.count({ where: { ...patientFilter, scannedAt: { [Op.gte]: oneWeekAgo } } });

    // Entries by page type
    const byPageType = await ScanLog.findAll({
      where: patientFilter,
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
