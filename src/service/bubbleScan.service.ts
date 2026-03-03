import fs from "fs";
import { BubbleScanResult } from "../models/BubbleScanResult";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { DiaryPage } from "../models/DiaryPage";
import { Op } from "sequelize";
import { getDiaryTypeForCaseType } from "../utils/constants";
import { formExtractionService } from "./formExtraction.service";

interface BubbleScanFilters {
    page?: number;
    limit?: number;
    templateName?: string;
    processingStatus?: string;
    patientId?: string;
    startDate?: Date;
    endDate?: Date;
    reviewed?: boolean;
    flagged?: boolean;
}

class BubbleScanService {

    /**
     * Returns empty — templates no longer used (Qubrid AI auto-detects page type)
     */
    getAvailableTemplates(): string[] {
        return [];
    }

    /**
     * Manual submission: Patient fills answers directly in the app
     */
    async manualSubmit(
        patientId: string,
        pageNumber: number,
        answers: Record<string, "yes" | "no">,
        diaryType: string
    ): Promise<BubbleScanResult> {
        // Fetch the diary page from DB
        const diaryPage = await DiaryPage.findOne({
            where: { pageNumber, diaryType, isActive: true },
        });
        if (!diaryPage) {
            throw new Error(
                `Diary page ${pageNumber} not found for ${diaryType}`
            );
        }

        // Enrich answers with question text from DB
        const enrichedResults: Record<string, any> = {};
        for (const [qId, answer] of Object.entries(answers)) {
            const questionDef = diaryPage.questions.find(
                (q) => q.id === qId
            );
            enrichedResults[qId] = {
                answer,
                confidence: 1.0,
                questionText: questionDef?.text || "Unknown question",
                category: questionDef?.category || "uncategorized",
            };
        }

        const record = await BubbleScanResult.create({
            patientId,
            pageId: `page-${pageNumber}`,
            pageNumber,
            diaryPageId: diaryPage.id,
            submissionType: "manual",
            processingStatus: "completed",
            scanResults: enrichedResults,
            scannedAt: new Date(),
        });

        return record;
    }

    /**
     * Process an uploaded diary page photo using Qubrid AI (Kimi-K2.5 vision).
     * Replaces the old Python OMR pipeline entirely.
     * Image is read from disk, processed in memory, then deleted for privacy compliance.
     */
    async processBubbleScan(
        patientId: string,
        pageId: string,
        templateName: string = "auto",
        imagePath: string,
        pageType?: string,
        diaryType?: string
    ): Promise<BubbleScanResult> {

        const scanRecord = await BubbleScanResult.create({
            patientId,
            pageId,
            pageType,
            submissionType: "scan",
            processingStatus: "pending",
            scannedAt: new Date(),
        });

        try {
            await scanRecord.update({ processingStatus: "processing" });

            // Read image from disk into memory, then process with Qubrid AI
            const imageBuffer = fs.readFileSync(imagePath);
            const extractionResult = await formExtractionService.extractForm(imageBuffer);

            const rawPageNum = extractionResult.formData.page_number;
            const detectedPageNumber = rawPageNum
                ? parseInt(String(rawPageNum), 10)
                : undefined;

            // Try to match with DiaryPage for enrichment
            let diaryPageId: string | undefined;
            if (detectedPageNumber && !isNaN(detectedPageNumber)) {
                const resolvedDiaryType = diaryType || getDiaryTypeForCaseType(undefined);
                const diaryPage = await DiaryPage.findOne({
                    where: { pageNumber: detectedPageNumber, diaryType: resolvedDiaryType, isActive: true },
                });
                if (diaryPage) diaryPageId = diaryPage.id;
            }

            await scanRecord.update({
                processingStatus: "completed",
                pageNumber: detectedPageNumber && !isNaN(detectedPageNumber) ? detectedPageNumber : undefined,
                diaryPageId,
                pageType: extractionResult.formData.form_type || pageType,
                scanResults: extractionResult.formData,
                processingMetadata: {
                    confidence: extractionResult.confidence,
                    flags: extractionResult.flags,
                    processingTimeMs: extractionResult.processingTimeMs,
                    modelUsed: extractionResult.modelUsed,
                    imageDimensions: extractionResult.imageDimensions,
                    qrCodeId: extractionResult.qrCodeId,
                },
            });

        } catch (error: any) {
            await scanRecord.update({
                processingStatus: "failed",
                errorMessage: error.message || "Unexpected processing error",
            });
        } finally {
            // Delete image from disk after processing (healthcare privacy compliance)
            try {
                if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            } catch {
                console.warn(`[BubbleScan] Could not delete temp image: ${imagePath}`);
            }
        }

        return scanRecord;
    }

    /**
     * Get scan history for a patient (paginated)
     */
    async getPatientScanHistory(patientId: string, page = 1, limit = 20) {
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

    /**
     * Get a single scan result by ID
     */
    async getScanById(scanId: string) {
        const scan = await BubbleScanResult.findByPk(scanId, {
            include: [
                {
                    model: Patient,
                    as: "patient",
                    attributes: ["id", "age", "gender", "stage"],
                },
            ],
        });
        if (!scan) throw new Error("Bubble scan result not found");
        return scan;
    }

    /**
     * Retry a failed scan
     */
    async retryScan(scanId: string): Promise<BubbleScanResult> {
        const existing = await BubbleScanResult.findByPk(scanId);
        if (!existing) throw new Error("Scan not found");
        if (existing.processingStatus !== "failed") {
            throw new Error("Can only retry failed scans");
        }

        // Look up patient to resolve diary type from caseType
        const patient = await Patient.findByPk(existing.patientId, {
            attributes: ["caseType"],
        });
        const diaryType = getDiaryTypeForCaseType(patient?.caseType);

        // Delete the failed record and reprocess
        const { patientId, pageId, templateName, imageUrl, pageType } =
            existing;
        await existing.destroy();

        return this.processBubbleScan(
            patientId,
            pageId,
            templateName,
            imageUrl!,
            pageType,
            diaryType
        );
    }

    /**
     * Doctor reviews a bubble scan result
     */
    async reviewBubbleScan(
        scanId: string,
        doctorId: string,
        data: {
            doctorNotes?: string;
            flagged?: boolean;
            overrides?: Record<string, "yes" | "no">;
        }
    ) {
        const scan = await BubbleScanResult.findByPk(scanId);
        if (!scan) throw new Error("Bubble scan result not found");

        const updateData: any = {
            doctorReviewed: true,
            reviewedBy: doctorId,
            reviewedAt: new Date(),
        };

        if (data.doctorNotes !== undefined)
            updateData.doctorNotes = data.doctorNotes;
        if (data.flagged !== undefined) updateData.flagged = data.flagged;

        // Process doctor overrides on individual answers
        if (data.overrides && Object.keys(data.overrides).length > 0) {
            const existingOverrides = (scan.doctorOverrides as any) || {};
            const currentResults = (scan.scanResults as any) || {};

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
            }

            updateData.doctorOverrides = existingOverrides;
            updateData.scanResults = currentResults;
        }

        await scan.update(updateData);
        return scan;
    }

    /**
     * Get all bubble scans for doctor review (with filters)
     */
    async getAllBubbleScans(
        doctorId: string,
        role: string,
        filters: BubbleScanFilters = {}
    ) {
        const {
            page = 1,
            limit = 20,
            templateName,
            processingStatus,
            patientId,
            startDate,
            endDate,
            reviewed,
            flagged,
        } = filters;

        const offset = (page - 1) * limit;

        // Get the doctor ID (if assistant, find their parent doctor)
        let resolvedDoctorId = doctorId;
        if (role === "ASSISTANT") {
            const assistant = await AppUser.findByPk(doctorId);
            if (!assistant || !assistant.parentId) {
                throw new Error("Assistant not linked to a doctor");
            }
            resolvedDoctorId = assistant.parentId;
        }

        // Get patient IDs belonging to this doctor
        const patients = await Patient.findAll({
            where: { doctorId: resolvedDoctorId },
            attributes: ["id"],
            raw: true,
        });
        const patientIds = patients.map((p: any) => p.id);

        const whereClause: any = {
            patientId: { [Op.in]: patientIds },
        };

        if (templateName) whereClause.templateName = templateName;
        if (processingStatus)
            whereClause.processingStatus = processingStatus;
        if (patientId) whereClause.patientId = patientId;
        if (reviewed !== undefined) whereClause.doctorReviewed = reviewed;
        if (flagged !== undefined) whereClause.flagged = flagged;

        if (startDate || endDate) {
            whereClause.scannedAt = {};
            if (startDate) whereClause.scannedAt[Op.gte] = startDate;
            if (endDate) whereClause.scannedAt[Op.lte] = endDate;
        }

        const { rows, count } = await BubbleScanResult.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Patient,
                    as: "patient",
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
}

export const bubbleScanService = new BubbleScanService();
