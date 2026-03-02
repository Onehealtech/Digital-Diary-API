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

    const doctorId = await this.resolveDoctorId(requesterId, role);

    // Build where clause for ScanLog (no doctorId here — it's on Patient)
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
    const unreviewed = await ScanLog.count({
      where: { doctorReviewed: false },
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

    const flaggedCount = await ScanLog.count({
      where: { flagged: true },
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
    const doctorId = await this.resolveDoctorId(requesterId, role);

    const entry = await ScanLog.findOne({
      where: { id: entryId },
      include: [
        {
          model: Patient,
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
   * Flag/unflag a diary entry
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
   * Get diary entries that need review (unreviewed + flagged)
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
      order: [["scannedAt", "ASC"]], // Oldest first
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
   * Get diary entry statistics for a doctor
   */
  async getDiaryEntryStats(doctorId: string) {
    const patientInclude = {
      model: Patient,
      as: "patient",
      where: { doctorId },
      required: true as const,
      attributes: [] as string[],
    };

    const total = await ScanLog.count({
      include: [patientInclude],
    });

    const reviewed = await ScanLog.count({
      where: { doctorReviewed: true },
      include: [patientInclude],
    });

    const unreviewed = total - reviewed;

    const flagged = await ScanLog.count({
      where: { flagged: true },
      include: [patientInclude],
    });

    // This week's entries
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const thisWeek = await ScanLog.count({
      where: {
        scannedAt: { [Op.gte]: oneWeekAgo },
      },
      include: [patientInclude],
    });

    // Entries by page type — get patient IDs first to avoid GROUP BY join issues
    const doctorPatients = await Patient.findAll({
      where: { doctorId },
      attributes: ["id"],
      raw: true,
    });
    const doctorPatientIds = doctorPatients.map((p: any) => p.id);

    const byPageType = await ScanLog.findAll({
      where: { patientId: { [Op.in]: doctorPatientIds } },
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
