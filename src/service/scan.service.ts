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

    whereClause.doctorId = doctorId;

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
          attributes: ["id", "name", "phoneNumber", "age", "gender", "stage"],
        },
      ],
      order: [["scannedAt", "DESC"]],
      limit,
      offset,
    });

    // Get summary stats
    const unreviewed = await ScanLog.count({
      where: {
        doctorId,
        doctorReviewed: false,
      },
    });

    const flaggedCount = await ScanLog.count({
      where: {
        doctorId,
        flagged: true,
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
      where: {
        id: entryId,
        doctorId,
      },
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "name", "phoneNumber", "age", "gender", "stage", "diaryType"],
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
    const entry = await ScanLog.findOne({
      where: {
        id: entryId,
        doctorId,
      },
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
  async toggleFlag(entryId: string, doctorId: string, flagged: boolean) {
    const entry = await ScanLog.findOne({
      where: {
        id: entryId,
        doctorId,
      },
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
      where: {
        doctorId,
        doctorReviewed: false,
      },
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "name", "phoneNumber"],
        },
      ],
      order: [["scannedAt", "ASC"]], // Oldest first
      limit: 50,
    });

    const flaggedEntries = await ScanLog.findAll({
      where: {
        doctorId,
        flagged: true,
      },
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "name", "phoneNumber"],
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
    const total = await ScanLog.count({
      where: { doctorId },
    });

    const reviewed = await ScanLog.count({
      where: {
        doctorId,
        doctorReviewed: true,
      },
    });

    const unreviewed = total - reviewed;

    const flagged = await ScanLog.count({
      where: {
        doctorId,
        flagged: true,
      },
    });

    // This week's entries
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const thisWeek = await ScanLog.count({
      where: {
        doctorId,
        scannedAt: { [Op.gte]: oneWeekAgo },
      },
    });

    // Entries by page type
    const byPageType = await ScanLog.findAll({
      where: { doctorId },
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
