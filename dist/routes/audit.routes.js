"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const audit_controller_1 = require("../controllers/audit.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const constants_1 = require("../utils/constants");
const router = (0, express_1.Router)();
/**
 * Audit Log Routes
 * Super Admin only - view system audit trail
 */
// Get audit statistics
router.get("/stats", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), audit_controller_1.auditController.getAuditStats);
// Search audit logs
router.get("/search", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), audit_controller_1.auditController.searchAuditLogs);
// Get audit logs for a specific user
router.get("/user/:userId", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), audit_controller_1.auditController.getUserAuditLogs);
// Get all audit logs
router.get("/", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), audit_controller_1.auditController.getAllAuditLogs);
exports.default = router;
