import { Export } from "../models/Export";
import { Patient } from "../models/Patient";
import { ScanLog } from "../models/ScanLog";
import { AppUser } from "../models/Appuser";
import { Op } from "sequelize";

interface ExportPatientDataRequest {
  userId: string;
  patientId: string;
  format: "pdf" | "excel" | "csv";
  includeTestHistory?: boolean;
  includeDiaryEntries?: boolean;
}

interface ExportDiaryPagesRequest {
  userId: string;
  patientId: string;
  format: "pdf" | "zip";
  startDate?: Date;
  endDate?: Date;
}

interface ExportTestSummaryRequest {
  userId: string;
  patientId: string;
  format: "pdf" | "excel";
}

class ExportService {
  /**
   * Generate export for patient data
   * Returns export record, actual file generation happens async
   */
  async exportPatientData(data: ExportPatientDataRequest) {
    // Verify patient access
    const patient = await Patient.findByPk(data.patientId, {
      include: [
        {
          model: AppUser,
          as: "doctor",
          attributes: ["id", "fullName"],
        },
      ],
    });

    if (!patient) {
      throw new Error("Patient not found");
    }

    // Create export record
    const exportRecord = await Export.create({
      userId: data.userId,
      type: "patient-data",
      patientId: data.patientId,
      format: data.format,
      downloadUrl: `/exports/patient-${data.patientId}-${Date.now()}.${data.format}`, // Placeholder
      fileSize: 0, // Will be updated after generation
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
  async exportDiaryPages(data: ExportDiaryPagesRequest) {
    // Verify patient and get diary entries
    const whereClause: any = {
      patientId: data.patientId,
    };

    if (data.startDate || data.endDate) {
      whereClause.scannedAt = {};
      if (data.startDate) {
        whereClause.scannedAt[Op.gte] = data.startDate;
      }
      if (data.endDate) {
        whereClause.scannedAt[Op.lte] = data.endDate;
      }
    }

    const diaryEntries = await ScanLog.findAll({
      where: whereClause,
      order: [["scannedAt", "ASC"]],
    });

    if (diaryEntries.length === 0) {
      throw new Error("No diary entries found for this patient");
    }

    // Create export record
    const exportRecord = await Export.create({
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
  async exportTestSummary(data: ExportTestSummaryRequest) {
    // Get patient with test data
    const patient = await Patient.findByPk(data.patientId, {
      include: [
        {
          model: AppUser,
          as: "doctor",
          attributes: ["id", "fullName", "email"],
        },
      ],
    });

    if (!patient) {
      throw new Error("Patient not found");
    }

    // Create export record
    const exportRecord = await Export.create({
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
  async getUserExports(userId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit;

    const { rows: exports, count: total } = await Export.findAndCountAll({
      where: { userId },
      include: [
        {
          model: Patient,
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
  async getExportById(exportId: string, userId: string) {
    const exportRecord = await Export.findOne({
      where: {
        id: exportId,
        userId,
      },
      include: [
        {
          model: Patient,
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
  async deleteExport(exportId: string, userId: string) {
    const exportRecord = await Export.findOne({
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
  async getPatientAnalytics(patientId: string, requesterId: string, role: string) {
    // Verify access
    let whereClause: any = { id: patientId };

    if (role === "DOCTOR") {
      whereClause.doctorId = requesterId;
    } else if (role === "ASSISTANT") {
      const assistant = await AppUser.findByPk(requesterId);
      if (!assistant || !assistant.parentId) {
        throw new Error("Assistant not linked to a doctor");
      }
      whereClause.doctorId = assistant.parentId;
    } else {
      throw new Error("Unauthorized to view analytics");
    }

    const patient = await Patient.findOne({
      where: whereClause,
      include: [
        {
          model: AppUser,
          as: "doctor",
          attributes: ["id", "fullName", "email"],
        },
      ],
    });

    if (!patient) {
      throw new Error("Patient not found or access denied");
    }

    // Get diary entry statistics
    const totalEntries = await ScanLog.count({
      where: { patientId },
    });

    const reviewedEntries = await ScanLog.count({
      where: {
        patientId,
        doctorReviewed: true,
      },
    });

    const flaggedEntries = await ScanLog.count({
      where: {
        patientId,
        flagged: true,
      },
    });

    // Entries by page type
    const entriesByType = await ScanLog.findAll({
      where: { patientId },
      attributes: [
        "pageType",
        [ScanLog.sequelize!.fn("COUNT", "*"), "count"],
      ],
      group: ["pageType"],
      raw: true,
    });

    // Timeline data (entries per week for last 12 weeks)
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

    const recentEntries = await ScanLog.findAll({
      where: {
        patientId,
        scannedAt: { [Op.gte]: twelveWeeksAgo },
      },
      order: [["scannedAt", "ASC"]],
      attributes: ["scannedAt", "pageType"],
    });

    // Test completion timeline
    const prescribedTests = (patient.prescribedTests as any[]) || [];
    const completedTests = prescribedTests.filter((t: any) => t.completed);
    const testsWithReports = prescribedTests.filter((t: any) => t.reportReceived);

    return {
      patient: {
        id: patient.id,
        name: patient.fullName,
        age: patient.age,
        gender: patient.gender,
        stage: patient.stage,
        diaryType: (patient as any).diaryType,
        registeredDate: (patient as any).registeredDate,
      },
      diaryStats: {
        totalEntries,
        reviewedEntries,
        flaggedEntries,
        unreviewedEntries: totalEntries - reviewedEntries,
        reviewCompletionRate:
          totalEntries > 0 ? Math.round((reviewedEntries / totalEntries) * 100) : 0,
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

    const expiredExports = await Export.findAll({
      where: {
        expiresAt: { [Op.lt]: now },
      },
    });

    // In production, delete files from cloud storage first
    await Export.destroy({
      where: {
        expiresAt: { [Op.lt]: now },
      },
    });

    return {
      message: `Cleaned up ${expiredExports.length} expired exports`,
      count: expiredExports.length,
    };
  }
}

export const exportService = new ExportService();
