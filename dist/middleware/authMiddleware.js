"use strict";
// src/middleware/authMiddleware.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientAuthCheck = exports.authCheck = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Import Models
const Appuser_1 = require("../models/Appuser");
const Patient_1 = require("../models/Patient");
// Import Utils
const response_1 = require("../utils/response");
const constants_1 = require("../utils/constants");
const ACCOUNT_DEACTIVATED_MESSAGE = 'Account deactivated. Please login again.';
const SESSION_EXPIRED_MESSAGE = 'Session expired. Please login again.';
// -------------------------------------------------------------------------
// MIDDLEWARE LOGIC
// -------------------------------------------------------------------------
/**
 * Role Check Middleware
 * Verifies if the authenticated AppUser has permission to access the route.
 * Also enforces force-logout using DB status + tokenVersion checks.
 */
const authCheck = (allowedRoles) => {
    return async (req, res, next) => {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, constants_1.API_MESSAGES.UNAUTHORIZED);
            return;
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            // Build the query dynamically to avoid undefined errors
            const whereClause = { id: decoded.AppUserId || decoded.id };
            // Only add email check if it exists in token
            if (decoded.email) {
                whereClause.email = decoded.email;
            }
            const user = await Appuser_1.AppUser.findOne({
                where: whereClause,
                raw: true,
            });
            if (!user) {
                (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, constants_1.API_MESSAGES.UNAUTHORIZED);
                return;
            }
            // Force logout deactivated users on every protected request.
            if (user.isActive === false) {
                (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, ACCOUNT_DEACTIVATED_MESSAGE);
                return;
            }
            // JWT cannot be revoked directly because it is stateless.
            // tokenVersion mismatch is used to invalidate old sessions immediately.
            const decodedTokenVersion = Number.isInteger(decoded.tokenVersion)
                ? decoded.tokenVersion
                : 0;
            const currentTokenVersion = Number.isInteger(user.tokenVersion)
                ? user.tokenVersion
                : 0;
            if (decodedTokenVersion !== currentTokenVersion) {
                (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, SESSION_EXPIRED_MESSAGE);
                return;
            }
            // User exists but role doesn't match -> 403 Forbidden (not 401)
            // 401 = bad/expired session, 403 = valid session but insufficient permissions.
            if (!allowedRoles.includes(user.role)) {
                (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.FORBIDDEN, constants_1.API_MESSAGES.FORBIDDEN);
                return;
            }
            // Force logout ON_HOLD or DELETED assistants
            if (user.role === 'ASSISTANT') {
                if (user.assistantStatus === 'ON_HOLD') {
                    (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, 'Your account is temporarily on hold. Contact your Doctor.');
                    return;
                }
                if (user.assistantStatus === 'DELETED') {
                    (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, 'Your account has been archived. Please contact your doctor.');
                    return;
                }
            }
            res.locals.auth = decoded;
            req.user = user;
            next();
        }
        catch (error) {
            console.error('Auth Check Error:', error);
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, constants_1.API_MESSAGES.UNAUTHORIZED);
            return;
        }
    };
};
exports.authCheck = authCheck;
/**
 * Patient Auth Check Middleware
 * Verifies JWT token for patient routes.
 * Enforces force-logout using patient status + tokenVersion checks.
 */
const patientAuthCheck = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, 'Authentication required');
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Verify this is a patient token
        if (decoded.type !== 'PATIENT') {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, 'Invalid patient token');
            return;
        }
        // Check if patient is still active in DB (force logout for deactivated patients)
        const patient = await Patient_1.Patient.findByPk(decoded.id, {
            attributes: ['id', 'status', 'language', 'tokenVersion'],
        });
        if (!patient || patient.status === 'INACTIVE') {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, ACCOUNT_DEACTIVATED_MESSAGE);
            return;
        }
        // JWT cannot be revoked directly because it is stateless.
        // tokenVersion mismatch is used to invalidate old sessions immediately.
        const decodedTokenVersion = Number.isInteger(decoded.tokenVersion)
            ? decoded.tokenVersion
            : 0;
        const currentTokenVersion = Number.isInteger(patient.tokenVersion)
            ? patient.tokenVersion
            : 0;
        if (decodedTokenVersion !== currentTokenVersion) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, SESSION_EXPIRED_MESSAGE);
            return;
        }
        // Attach patient info to request (including language for translation middleware)
        req.user = {
            id: decoded.id,
            diaryId: decoded.diaryId,
            fullName: decoded.fullName,
            caseType: decoded.caseType,
            type: decoded.type,
            language: patient.language || 'en',
            tokenVersion: patient.tokenVersion ?? 0,
        };
        next();
    }
    catch (error) {
        console.error('Patient Auth Check Error:', error);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, 'Invalid or expired token');
        return;
    }
};
exports.patientAuthCheck = patientAuthCheck;
