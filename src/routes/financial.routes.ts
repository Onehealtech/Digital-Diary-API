import { Router } from "express";
import { financialController } from "../controllers/financial.controller";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

const router = Router();

/**
 * Financial System Routes
 * Super Admin manages all financials
 * Vendors can view their own transactions/statements
 */

// Get financial dashboard (Super Admin only)
router.get(
  "/dashboard",
  authCheck([UserRole.SUPER_ADMIN]),
  financialController.getFinancialDashboard
);

// Get all transactions (Super Admin sees all, Vendor sees their own)
router.get(
  "/transactions",
  authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR]),
  financialController.getAllTransactions
);

// Get transaction statistics
router.get(
  "/stats",
  authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR]),
  financialController.getTransactionStats
);

// Get financial statement (Super Admin can specify vendor, Vendor sees their own)
router.get(
  "/statement",
  authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR]),
  financialController.getStatement
);

// Process payout to vendor (Super Admin only)
router.post(
  "/payout",
  authCheck([UserRole.SUPER_ADMIN]),
  financialController.processPayout
);

export default router;
