// src/middleware/ownershipMiddleware.ts

import { Response, NextFunction } from 'express';
import { Patient } from '../models/Patient';
import { AuthenticatedRequest } from './authMiddleware';
import { responseMiddleware } from '../utils/response';
import { HTTP_STATUS, UserRole } from '../utils/constants';

/**
 * Ownership Middleware
 * Verifies that the authenticated user owns (or has access to) the requested patient.
 * 
 * Access rules:
 * - SUPER_ADMIN: full access
 * - VENDOR: full access (acts on behalf of pharmacist — reads only)
 * - DOCTOR: only their own patients (patient.doctorId === user.id)
 * - ASSISTANT: only their parent doctor's patients (patient.doctorId === user.parentId)
 */
export const requirePatientAccess = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const patientId = req.params.patientId || req.body.patientId;

        if (!patientId) {
            responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, 'Patient ID is required');
            return;
        }

        const patient = await Patient.findByPk(patientId);

        if (!patient) {
            responseMiddleware(res, HTTP_STATUS.NOT_FOUND, 'Patient not found');
            return;
        }

        const user = req.user!;
        const role = user.role as UserRole;

        let hasAccess = false;

        switch (role) {
            case UserRole.SUPER_ADMIN:
                hasAccess = true;
                break;

            case UserRole.VENDOR:
                // Vendor can view all patients (acts on behalf of pharmacist)
                hasAccess = true;
                break;

            case UserRole.DOCTOR:
                hasAccess = patient.doctorId === user.id;
                break;

            case UserRole.ASSISTANT:
                hasAccess = !!user.parentId && patient.doctorId === user.parentId;
                break;

            default:
                hasAccess = false;
        }

        if (!hasAccess) {
            responseMiddleware(res, HTTP_STATUS.FORBIDDEN, 'You do not have access to this patient');
            return;
        }

        // Attach patient to request for downstream use
        (req as any).patient = patient;
        next();
    } catch (error) {
        console.error('Ownership check error:', error);
        responseMiddleware(res, HTTP_STATUS.SERVER_ERROR, 'Ownership verification failed');
    }
};

/**
 * Resolve Doctor ID
 * Utility to determine the effective doctorId based on the user's role.
 * - DOCTOR: returns their own ID
 * - ASSISTANT: returns their parentId (the linked Doctor's ID)
 * - Others: returns null
 */
export const resolveDoctorId = (user: any): string | null => {
    if (user.role === UserRole.DOCTOR) {
        return user.id;
    }
    if (user.role === UserRole.ASSISTANT && user.parentId) {
        return user.parentId;
    }
    return null;
};
