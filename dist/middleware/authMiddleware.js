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
// -------------------------------------------------------------------------
// MIDDLEWARE LOGIC
// -------------------------------------------------------------------------
/**
 * Protect Middleware
 * Verifies JWT token and attaches AppUser to request
 */
/**
 * Role Check Middleware
 * Verifies if the authenticated AppUser has permission to access the route
 * Uses UserRole enum for type-safe role checking
 */
const authCheck = (allowedRoles) => {
    return async (req, res, next) => {
        const token = req.headers["authorization"]?.split(" ")[1];
        if (!token) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, constants_1.API_MESSAGES.UNAUTHORIZED);
            return;
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            // Build the query dynamically to avoid 'undefined' errors
            const whereClause = { id: decoded.AppUserId || decoded.id };
            // Only add email check if it exists in token
            if (decoded.email) {
                whereClause.email = decoded.email;
            }
            const user = await Appuser_1.AppUser.findOne({
                where: whereClause,
                raw: true
            });
            if (!user) {
                (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, constants_1.API_MESSAGES.UNAUTHORIZED);
                return;
            }
            // User exists but role doesn't match → 403 Forbidden (not 401)
            // This distinction is critical: 401 = bad/expired token (triggers auto-logout),
            // 403 = valid token but insufficient permissions (no logout needed).
            if (!allowedRoles.includes(user.role)) {
                (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.FORBIDDEN, constants_1.API_MESSAGES.FORBIDDEN);
                return;
            }
            // Force logout deactivated users (isActive = false)
            if (user.isActive === false) {
                (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, 'Your account has been deactivated. Please contact your administrator.');
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
 * Verifies JWT token for patient routes
 */
const patientAuthCheck = async (req, res, next) => {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) {
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, "Authentication required");
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Verify this is a patient token
        if (decoded.type !== "PATIENT") {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, "Invalid patient token");
            return;
        }
        // Check if patient is still active in DB (force logout for deactivated patients)
        const patient = await Patient_1.Patient.findByPk(decoded.id, {
            attributes: ["id", "status", "language"],
        });
        if (!patient || patient.status === "INACTIVE") {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, "Your account has been deactivated. Please contact your doctor.");
            return;
        }
        // Attach patient info to request (including language for translation middleware)
        req.user = {
            id: decoded.id,
            diaryId: decoded.diaryId,
            fullName: decoded.fullName,
            caseType: decoded.caseType,
            type: decoded.type,
            language: patient.language || "en",
        };
        next();
    }
    catch (error) {
        console.error('Patient Auth Check Error:', error);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, "Invalid or expired token");
        return;
    }
};
exports.patientAuthCheck = patientAuthCheck;
