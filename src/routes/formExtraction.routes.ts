import express from 'express';
import { formExtractionUpload } from '../middleware/upload.middleware';
import { extractForm } from '../controllers/formExtraction.controller';
import { patientAuthCheck, authCheck } from '../middleware/authMiddleware';
import { UserRole } from '../utils/constants';

const router = express.Router();

/**
 * POST /api/v1/extract-form
 * For patient mobile app — requires patient JWT.
 * Accepts a photo of a CANTrac diary page and returns structured JSON.
 *
 * Multipart field:  image  (JPEG or PNG, max 10 MB)
 * Query param:      page_type  (optional hint: summary | schedule | done_report | patient_info)
 */
router.post(
    '/extract-form',
    patientAuthCheck,
    formExtractionUpload.single('image'),
    extractForm
);

/**
 * POST /api/v1/staff/extract-form
 * For Doctor / Assistant web dashboard — requires staff JWT.
 * Same extraction logic, different auth.
 */
router.post(
    '/staff/extract-form',
    authCheck([UserRole.DOCTOR, UserRole.ASSISTANT]),
    formExtractionUpload.single('image'),
    extractForm
);

export default router;
