import { Op } from "sequelize";
import { BubbleScanResult } from "../../models/BubbleScanResult";
import { ScanLog } from "../../models/ScanLog";
import { Patient } from "../../models/Patient";
import { AppUser } from "../../models/Appuser";
import { DiaryPage } from "../../models/DiaryPage";
import {
    EnrichedResult,
    ProcessingMetadata,
    ProcessingStatus,
    SubmissionType,
    ScanFilterOptions,
    PaginatedResult,
} from "./visionScan.types";

export class VisionScanRepository {
    async findDiaryPage(
        pageNumber: number,
        diaryType: string
    ): Promise<DiaryPage | null> {
        return DiaryPage.findOne({
            where: { pageNumber, diaryType, isActive: true },
        });
    }

    async createScanRecord(data: {
        patientId: string;
        pageNumber: number;
        diaryPageId: string;
        submissionType: SubmissionType;
        processingStatus: ProcessingStatus;
        imageUrl?: string;
        scanResults?: Record<string, EnrichedResult>;
    }): Promise<BubbleScanResult> {
        return BubbleScanResult.create({
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

    async updateScanCompleted(
        scan: BubbleScanResult,
        data: {
            scanResults: Record<string, EnrichedResult>;
            rawConfidenceScores: Record<string, number>;
            processingMetadata: ProcessingMetadata;
            flagged: boolean;
        }
    ): Promise<void> {
        await scan.update({
            processingStatus: ProcessingStatus.COMPLETED,
            scanResults: data.scanResults,
            rawConfidenceScores: data.rawConfidenceScores,
            processingMetadata: data.processingMetadata,
            flagged: data.flagged,
        });
    }

    async updateScanFailed(
        scan: BubbleScanResult,
        errorMessage: string
    ): Promise<void> {
        await scan.update({
            processingStatus: ProcessingStatus.FAILED,
            errorMessage,
        });
    }

    async syncToScanLog(
        patientId: string,
        pageNumber: number,
        enrichedResults: Record<string, EnrichedResult>
    ): Promise<void> {
        const scanLogPageId = `backend_page_${pageNumber}`;

        const scanData: Record<string, string | null> = {};
        for (const [qId, qResult] of Object.entries(enrichedResults)) {
            scanData[qId] = qResult.answer;
            if (qResult.questionText) {
                scanData[`${qId}_text`] = qResult.questionText;
            }
        }

        const [record, created] = await ScanLog.upsert(
            {
                patientId,
                pageId: scanLogPageId,
                scanData,
                scannedAt: new Date(),
                isUpdated: true,
                updatedCount: 1,
            },
            { returning: true }
        );

        if (!created && record) {
            await record.update({
                updatedCount: record.updatedCount + 1,
            });
        }
    }

    async findScanById(scanId: string): Promise<BubbleScanResult | null> {
        return BubbleScanResult.findByPk(scanId);
    }

    async findScanByIdWithPatient(
        scanId: string
    ): Promise<BubbleScanResult | null> {
        return BubbleScanResult.findByPk(scanId, {
            include: [
                {
                    model: Patient,
                    as: "patient",
                    attributes: ["id", "age", "gender", "stage"],
                },
            ],
        });
    }

    async deleteScan(scan: BubbleScanResult): Promise<void> {
        await scan.destroy();
    }

    async findPatientCaseType(
        patientId: string
    ): Promise<string | undefined> {
        const patient = await Patient.findByPk(patientId, {
            attributes: ["caseType"],
        });
        return patient?.caseType;
    }

    async getPatientScans(
        patientId: string,
        page: number,
        limit: number
    ): Promise<PaginatedResult<BubbleScanResult>> {
        const offset = (page - 1) * limit;
        const { rows, count } = await BubbleScanResult.findAndCountAll({
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

    async resolveDoctorId(userId: string, role: string): Promise<string> {
        if (role === "ASSISTANT") {
            const assistant = await AppUser.findByPk(userId);
            if (!assistant || !assistant.parentId) {
                throw new Error("Assistant not linked to a doctor");
            }
            return assistant.parentId;
        }
        return userId;
    }

    async getDoctorPatientScans(
        doctorId: string,
        role: string,
        filters: ScanFilterOptions
    ): Promise<PaginatedResult<BubbleScanResult>> {
        const {
            page = 1,
            limit = 20,
            processingStatus,
            patientId,
            startDate,
            endDate,
            reviewed,
            flagged,
        } = filters;

        const offset = (page - 1) * limit;
        const resolvedDoctorId = await this.resolveDoctorId(doctorId, role);

        const whereClause: Record<string, unknown> = {};
        const patientWhere: Record<string, unknown> = {
            doctorId: resolvedDoctorId,
        };

        if (processingStatus) whereClause.processingStatus = processingStatus;
        if (patientId) {
            whereClause.patientId = patientId;
        }
        if (reviewed !== undefined) whereClause.doctorReviewed = reviewed;
        if (flagged !== undefined) whereClause.flagged = flagged;

        if (startDate || endDate) {
            const scannedAt: Record<symbol, Date> = {};
            if (startDate) scannedAt[Op.gte] = startDate;
            if (endDate) scannedAt[Op.lte] = endDate;
            whereClause.scannedAt = scannedAt;
        }

        const { rows, count } = await BubbleScanResult.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Patient,
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

    async updateScanReview(
        scan: BubbleScanResult,
        doctorId: string,
        data: {
            doctorNotes?: string;
            flagged?: boolean;
            overrides?: Record<string, string>;
        }
    ): Promise<BubbleScanResult> {
        const updateData: Record<string, unknown> = {
            doctorReviewed: true,
            reviewedBy: doctorId,
            reviewedAt: new Date(),
        };

        if (data.doctorNotes !== undefined)
            updateData.doctorNotes = data.doctorNotes;
        if (data.flagged !== undefined) updateData.flagged = data.flagged;

        if (data.overrides && Object.keys(data.overrides).length > 0) {
            const existingOverrides =
                (scan.doctorOverrides as Record<string, unknown>) || {};
            const currentResults =
                (scan.scanResults as Record<string, EnrichedResult>) || {};

            for (const [qId, correctedAnswer] of Object.entries(
                data.overrides
            )) {
                if (!currentResults[qId]) continue;
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

export const visionScanRepository = new VisionScanRepository();
