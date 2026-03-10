"use strict";
// src/middleware/ownershipMiddleware.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDoctorId = exports.requirePatientAccess = void 0;
const Patient_1 = require("../models/Patient");
const response_1 = require("../utils/response");
const constants_1 = require("../utils/constants");
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
const requirePatientAccess = async (req, res, next) => {
    try {
        const patientId = req.params.patientId || req.body.patientId;
        if (!patientId) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, 'Patient ID is required');
            return;
        }
        const patient = await Patient_1.Patient.findByPk(patientId);
        if (!patient) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.NOT_FOUND, 'Patient not found');
            return;
        }
        const user = req.user;
        const role = user.role;
        let hasAccess = false;
        switch (role) {
            case constants_1.UserRole.SUPER_ADMIN:
                hasAccess = true;
                break;
            case constants_1.UserRole.VENDOR:
                // Vendor can view all patients (acts on behalf of pharmacist)
                hasAccess = true;
                break;
            case constants_1.UserRole.DOCTOR:
                hasAccess = patient.doctorId === user.id;
                break;
            case constants_1.UserRole.ASSISTANT:
                // Must belong to the parent doctor's patients
                hasAccess = !!user.parentId && patient.doctorId === user.parentId;
                // If "selected" access mode, also check assigned patient list
                if (hasAccess && user.patientAccessMode === "selected") {
                    const assigned = user.assignedPatientIds || [];
                    hasAccess = assigned.includes(patientId);
                }
                break;
            default:
                hasAccess = false;
        }
        if (!hasAccess) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.FORBIDDEN, 'You do not have access to this patient');
            return;
        }
        // Attach patient to request for downstream use
        req.patient = patient;
        next();
    }
    catch (error) {
        console.error('Ownership check error:', error);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.SERVER_ERROR, 'Ownership verification failed');
    }
};
exports.requirePatientAccess = requirePatientAccess;
/**
 * Resolve Doctor ID
 * Utility to determine the effective doctorId based on the user's role.
 * - DOCTOR: returns their own ID
 * - ASSISTANT: returns their parentId (the linked Doctor's ID)
 * - Others: returns null
 */
const resolveDoctorId = (user) => {
    if (user.role === constants_1.UserRole.DOCTOR) {
        return user.id;
    }
    if (user.role === constants_1.UserRole.ASSISTANT && user.parentId) {
        return user.parentId;
    }
    return null;
};
exports.resolveDoctorId = resolveDoctorId;
