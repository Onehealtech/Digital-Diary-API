import { Request } from "express";
import { auditService } from "../service/audit.service";

type AuditUserRole = "super_admin" | "doctor" | "vendor" | "assistant" | "patient";

const ROLE_MAP: Record<string, AuditUserRole> = {
    SUPER_ADMIN: "super_admin",
    DOCTOR: "doctor",
    VENDOR: "vendor",
    ASSISTANT: "assistant",
    PATIENT: "patient",
};

interface LogActivityParams {
    req: Request;
    userId: string;
    userRole: string;
    action: string;
    details: object;
}

/**
 * Fire-and-forget activity logger.
 * Wraps auditService.createAuditLog() — never blocks the response.
 */
export function logActivity({ req, userId, userRole, action, details }: LogActivityParams): void {
    auditService
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
