"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = void 0;
const audit_service_1 = require("../service/audit.service");
const ROLE_MAP = {
    SUPER_ADMIN: "super_admin",
    DOCTOR: "doctor",
    VENDOR: "vendor",
    ASSISTANT: "assistant",
    PATIENT: "patient",
};
/**
 * Fire-and-forget activity logger.
 * Wraps auditService.createAuditLog() — never blocks the response.
 */
function logActivity({ req, userId, userRole, action, details }) {
    audit_service_1.auditService
        .createAuditLog({
        userId,
        userRole: ROLE_MAP[userRole] || "doctor",
        action,
        details,
        ipAddress: req.ip || req.socket?.remoteAddress || "unknown",
        userAgent: req.headers["user-agent"],
    })
        .catch((err) => {
        console.error("[ActivityLog] Failed to write audit log:", err.message);
    });
}
exports.logActivity = logActivity;
