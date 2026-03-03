import { Request, Response } from 'express';
import { formExtractionService, PageTypeHint } from '../service/formExtraction.service';
import { BubbleScanResult } from '../models/BubbleScanResult';

const VALID_PAGE_TYPES: PageTypeHint[] = ['summary', 'schedule', 'done_report', 'patient_info'];
const MAX_SIZE_BYTES = parseInt(process.env.MAX_IMAGE_SIZE_MB || '10') * 1024 * 1024;

/**
 * POST /api/v1/extract-form          — patient mobile app (patientAuthCheck)
 * POST /api/v1/staff/extract-form    — staff web dashboard (authCheck DOCTOR/ASSISTANT)
 *
 * Accepts: multipart/form-data with field "image" (JPEG/PNG, max 10MB)
 * Optional query:  ?page_type=summary|schedule|done_report|patient_info
 * Optional body:   patientId  (staff route only — links result to that patient)
 *
 * Patient route: auto-saves extracted data to BubbleScanResult linked to the patient.
 * Staff route:   saves if patientId is provided in the request body.
 */
export const extractForm = async (req: Request, res: Response): Promise<void> => {
    const file = (req as any).file as Express.Multer.File | undefined;
    const user = (req as any).user as any;

    // ── Validation ────────────────────────────────────────────────────────────

    if (!file) {
        res.status(400).json({
            success: false,
            error: { code: 'NO_IMAGE', message: 'No image provided. Send a JPEG or PNG image in the "image" field.' },
        });
        return;
    }

    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.mimetype)) {
        res.status(400).json({
            success: false,
            error: { code: 'INVALID_IMAGE_FORMAT', message: 'Only JPEG and PNG images are accepted.' },
        });
        return;
    }

    if (file.size > MAX_SIZE_BYTES) {
        res.status(400).json({
            success: false,
            error: { code: 'IMAGE_TOO_LARGE', message: `Image exceeds the ${process.env.MAX_IMAGE_SIZE_MB || 10}MB limit.` },
        });
        return;
    }

    const rawHint = req.query.page_type as string | undefined;
    const pageTypeHint: PageTypeHint | undefined =
        rawHint && VALID_PAGE_TYPES.includes(rawHint as PageTypeHint)
            ? (rawHint as PageTypeHint)
            : undefined;

    if (rawHint && !pageTypeHint) {
        res.status(400).json({
            success: false,
            error: {
                code: 'INVALID_PAGE_TYPE',
                message: `Invalid page_type "${rawHint}". Allowed: ${VALID_PAGE_TYPES.join(', ')}.`,
            },
        });
        return;
    }

    // ── Processing ───────────────────────────────────────────────────────────

    try {
        const result = await formExtractionService.extractForm(file.buffer, pageTypeHint);

        // ── Auto-save to BubbleScanResult ─────────────────────────────────────
        // Patient route: req.user.id = patient ID (set by patientAuthCheck)
        // Staff route:   req.user.role = DOCTOR|ASSISTANT, patientId comes from body
        const isStaff = user?.role === 'DOCTOR' || user?.role === 'ASSISTANT';
        const patientId: string | undefined = isStaff
            ? (req.body?.patientId as string | undefined)
            : (user?.id as string | undefined);

        let savedScanId: string | undefined;
        if (patientId) {
            const rawPageNum = result.formData.page_number;
            const pageNumber = rawPageNum ? parseInt(String(rawPageNum), 10) : undefined;

            const scanRecord = await BubbleScanResult.create({
                patientId,
                pageId: rawPageNum ? `page-${rawPageNum}` : `page-${Date.now()}`,
                pageNumber: pageNumber && !isNaN(pageNumber) ? pageNumber : undefined,
                submissionType: 'scan',
                processingStatus: 'completed',
                pageType: result.formData.form_type,
                scanResults: result.formData,
                processingMetadata: {
                    confidence: result.confidence,
                    flags: result.flags,
                    processingTimeMs: result.processingTimeMs,
                    modelUsed: result.modelUsed,
                    imageDimensions: result.imageDimensions,
                    qrCodeId: result.qrCodeId,
                },
                scannedAt: new Date(),
            });
            savedScanId = scanRecord.id;
            console.log(`[FormExtraction] Saved to BubbleScanResult id=${savedScanId} patientId=${patientId}`);
        }

        res.status(200).json({
            success: true,
            data: result.formData,
            ...(savedScanId && { scan_id: savedScanId }),
            metadata: {
                processing_time_ms: result.processingTimeMs,
                model_used: result.modelUsed,
                confidence: result.confidence,
                flags: result.flags,
                image_dimensions: result.imageDimensions,
            },
        });
    } catch (error: any) {
        console.error('[FormExtraction Controller] Error:', error.message);

        if (error.message?.includes('RATE_LIMITED') || error.message?.toLowerCase().includes('rate limit')) {
            res.status(429).json({
                success: false,
                error: { code: 'RATE_LIMITED', message: 'AI API rate limit reached. Please try again shortly.' },
            });
            return;
        }

        if (error.message?.includes('timed out')) {
            res.status(504).json({
                success: false,
                error: { code: 'API_TIMEOUT', message: 'AI API did not respond in time. Please retry.' },
            });
            return;
        }

        if (
            error.message?.toLowerCase().includes('unsupported image format') ||
            error.message?.toLowerCase().includes('input buffer contains unsupported image format')
        ) {
            res.status(422).json({
                success: false,
                error: { code: 'UNPROCESSABLE_IMAGE', message: 'The image could not be processed. Ensure it is a valid JPEG or PNG.' },
            });
            return;
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'EXTRACTION_FAILED',
                message: process.env.NODE_ENV === 'development'
                    ? error.message
                    : 'Form extraction failed. Please try again.',
            },
        });
    }
};
