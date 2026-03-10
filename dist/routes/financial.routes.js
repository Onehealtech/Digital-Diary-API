"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const financial_controller_1 = require("../controllers/financial.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const constants_1 = require("../utils/constants");
const router = (0, express_1.Router)();
/**
 * Financial System Routes
 * Super Admin manages all financials
 * Vendors can view their own transactions/statements
 */
// Get financial dashboard (Super Admin only)
router.get("/dashboard", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), financial_controller_1.financialController.getFinancialDashboard);
// Get all transactions (Super Admin sees all, Vendor sees their own)
router.get("/transactions", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR]), financial_controller_1.financialController.getAllTransactions);
// Get transaction statistics
router.get("/stats", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR]), financial_controller_1.financialController.getTransactionStats);
// Get financial statement (Super Admin can specify vendor, Vendor sees their own)
router.get("/statement", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR]), financial_controller_1.financialController.getStatement);
// Process payout to vendor (Super Admin only)
router.post("/payout", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), financial_controller_1.financialController.processPayout);
exports.default = router;
