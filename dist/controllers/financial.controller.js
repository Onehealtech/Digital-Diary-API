"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.financialController = void 0;
const financial_service_1 = require("../service/financial.service");
const response_1 = require("../utils/response");
class FinancialController {
    /**
     * GET /api/v1/financials/dashboard
     * Get financial dashboard (Super Admin only)
     */
    async getFinancialDashboard(req, res) {
        try {
            const role = req.user?.role;
            if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Only Super Admins can access financial dashboard", 403);
            }
            const dashboard = await financial_service_1.financialService.getFinancialDashboard();
            return (0, response_1.sendResponse)(res, dashboard, "Financial dashboard fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * GET /api/v1/financials/transactions
     * Get all transactions with filters
     */
    async getAllTransactions(req, res) {
        try {
            const role = req.user?.role;
            const userId = req.user?.id;
            if (!userId || !role) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const { page, limit, type, startDate, endDate, vendorId } = req.query;
            // Super Admin can see all transactions
            // Vendors can only see their own transactions
            const filters = {
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
                type: type,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
            };
            if (role === "VENDOR") {
                filters.vendorId = userId; // Force vendor to see only their transactions
            }
            else if (role === "SUPER_ADMIN" && vendorId) {
                filters.vendorId = vendorId;
            }
            else if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Unauthorized to view transactions", 403);
            }
            const result = await financial_service_1.financialService.getAllTransactions(filters);
            return (0, response_1.sendResponse)(res, result, "Transactions fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * POST /api/v1/financials/payout
     * Process payout to vendor (Super Admin only)
     */
    async processPayout(req, res) {
        try {
            const superAdminId = req.user?.id;
            const role = req.user?.role;
            if (!superAdminId || role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Only Super Admins can process payouts", 403);
            }
            const { vendorId, amount, paymentMethod, description } = req.body;
            // Validation
            if (!vendorId || !amount || !paymentMethod) {
                return (0, response_1.sendError)(res, "vendorId, amount, and paymentMethod are required", 400);
            }
            if (amount <= 0) {
                return (0, response_1.sendError)(res, "Amount must be greater than 0", 400);
            }
            const result = await financial_service_1.financialService.processPayout(superAdminId, {
                vendorId,
                amount,
                paymentMethod,
                description,
            });
            return (0, response_1.sendResponse)(res, result, "Payout processed successfully", 201);
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * GET /api/v1/financials/statement
     * Get financial statement
     */
    async getStatement(req, res) {
        try {
            const role = req.user?.role;
            const userId = req.user?.id;
            if (!userId || !role) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const { vendorId, startDate, endDate } = req.query;
            let targetVendorId;
            if (role === "VENDOR") {
                // Vendor can only see their own statement
                targetVendorId = userId;
            }
            else if (role === "SUPER_ADMIN" && vendorId) {
                // Super Admin can see any vendor's statement
                targetVendorId = vendorId;
            }
            else if (role === "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "vendorId is required for Super Admin", 400);
            }
            else {
                return (0, response_1.sendError)(res, "Unauthorized to view statement", 403);
            }
            const statement = await financial_service_1.financialService.getVendorStatement(targetVendorId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
            return (0, response_1.sendResponse)(res, statement, "Financial statement fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
    /**
     * GET /api/v1/financials/stats
     * Get transaction statistics
     */
    async getTransactionStats(req, res) {
        try {
            const role = req.user?.role;
            const userId = req.user?.id;
            if (!userId || !role) {
                return (0, response_1.sendError)(res, "Unauthorized", 401);
            }
            const { vendorId } = req.query;
            let targetVendorId;
            if (role === "VENDOR") {
                targetVendorId = userId;
            }
            else if (role === "SUPER_ADMIN" && vendorId) {
                targetVendorId = vendorId;
            }
            else if (role !== "SUPER_ADMIN") {
                return (0, response_1.sendError)(res, "Unauthorized to view stats", 403);
            }
            const stats = await financial_service_1.financialService.getTransactionStats(targetVendorId);
            return (0, response_1.sendResponse)(res, stats, "Transaction stats fetched successfully");
        }
        catch (error) {
            return (0, response_1.sendError)(res, error.message);
        }
    }
}
exports.financialController = new FinancialController();
