import { Router } from "express";
import { auditController } from "../controllers/audit.controller";
import { authCheck } from "../middleware/authMiddleware";

const router = Router();

/**
 * Audit Log Routes
 * Super Admin only - view system audit trail
 */

// Get audit statistics
router.get(
  "/stats",
  authCheck(["SUPER_ADMIN"]),
  auditController.getAuditStats
);

// Search audit logs
router.get(
  "/search",
  authCheck(["SUPER_ADMIN"]),
  auditController.searchAuditLogs
);

// Get audit logs for a specific user
router.get(
  "/user/:userId",
  authCheck(["SUPER_ADMIN"]),
  auditController.getUserAuditLogs
);

// Get all audit logs
router.get(
  "/",
  authCheck(["SUPER_ADMIN"]),
  auditController.getAllAuditLogs
);

export default router;
