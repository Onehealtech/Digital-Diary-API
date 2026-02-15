import { Router } from "express";
import { financialController } from "../controllers/financial.controller";
import { authCheck } from "../middleware/authMiddleware";

const router = Router();

/**
 * Financial System Routes
 * Super Admin manages all financials
 * Vendors can view their own transactions/statements
 */

// Get financial dashboard (Super Admin only)
router.get(
  "/dashboard",
  authCheck(["SUPER_ADMIN"]),
  financialController.getFinancialDashboard
);

// Get all transactions (Super Admin sees all, Vendor sees their own)
router.get(
  "/transactions",
  authCheck(["SUPER_ADMIN", "VENDOR"]),
  financialController.getAllTransactions
);

// Get transaction statistics
router.get(
  "/stats",
  authCheck(["SUPER_ADMIN", "VENDOR"]),
  financialController.getTransactionStats
);

// Get financial statement (Super Admin can specify vendor, Vendor sees their own)
router.get(
  "/statement",
  authCheck(["SUPER_ADMIN", "VENDOR"]),
  financialController.getStatement
);

// Process payout to vendor (Super Admin only)
router.post(
  "/payout",
  authCheck(["SUPER_ADMIN"]),
  financialController.processPayout
);

export default router;
