"use strict";
// src/middleware/subscriptionMiddleware.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireManualEntryEnabled = exports.requireScanEnabled = exports.enforcePageLimit = void 0;
const response_1 = require("../utils/response");
const constants_1 = require("../utils/constants");
const subscription_service_1 = require("../service/subscription.service");
/**
 * Middleware to enforce diary page limit based on subscription plan.
 * Attach after patientAuthCheck to have req.user.id available.
 */
const enforcePageLimit = async (req, res, next) => {
    try {
        const patientId = req.user?.id;
        if (!patientId) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, "Patient not authenticated");
            return;
        }
        const check = await (0, subscription_service_1.canAddDiaryPage)(patientId);
        if (!check.allowed) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.FORBIDDEN, check.reason || "Page limit exceeded");
            return;
        }
        next();
    }
    catch (error) {
        console.error("Page limit check error:", error);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to verify page limit");
    }
};
exports.enforcePageLimit = enforcePageLimit;
/**
 * Middleware to enforce scan feature access based on subscription plan.
 */
const requireScanEnabled = async (req, res, next) => {
    try {
        const patientId = req.user?.id;
        if (!patientId) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, "Patient not authenticated");
            return;
        }
        const enabled = await (0, subscription_service_1.isScanEnabled)(patientId);
        if (!enabled) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.FORBIDDEN, "Scan feature is not available on your current plan. Please upgrade to access this feature.");
            return;
        }
        next();
    }
    catch (error) {
        console.error("Scan access check error:", error);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to verify scan access");
    }
};
exports.requireScanEnabled = requireScanEnabled;
/**
 * Middleware to enforce manual entry access based on subscription plan.
 */
const requireManualEntryEnabled = async (req, res, next) => {
    try {
        const patientId = req.user?.id;
        if (!patientId) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, "Patient not authenticated");
            return;
        }
        const enabled = await (0, subscription_service_1.isManualEntryEnabled)(patientId);
        if (!enabled) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.FORBIDDEN, "Manual entry is not available on your current plan. Please upgrade to access this feature.");
            return;
        }
        next();
    }
    catch (error) {
        console.error("Manual entry access check error:", error);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to verify manual entry access");
    }
};
exports.requireManualEntryEnabled = requireManualEntryEnabled;
