"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = void 0;
const response_1 = require("../utils/response");
const constants_1 = require("../utils/constants");
/**
 * Middleware factory that checks a specific permission for ASSISTANT users.
 * DOCTOR, SUPER_ADMIN, and VENDOR bypass this check entirely.
 * Must be used AFTER authCheck in the middleware chain.
 */
const requirePermission = (permission) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.UNAUTHORIZED, constants_1.API_MESSAGES.UNAUTHORIZED);
            return;
        }
        // Non-ASSISTANT roles bypass permission checks
        if (user.role !== constants_1.UserRole.ASSISTANT) {
            next();
            return;
        }
        // ASSISTANT: check granular permission
        const permissions = user.permissions || {};
        if (permissions[permission] === true) {
            next();
            return;
        }
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.FORBIDDEN, constants_1.API_MESSAGES.FORBIDDEN);
        return;
    };
};
exports.requirePermission = requirePermission;
