import { Response } from "express";
import { financialService } from "../service/financial.service";
import { sendResponse, sendError } from "../utils/response";
import { AuthRequest } from "../middleware/authMiddleware";

class FinancialController {
  /**
   * GET /api/v1/financials/dashboard
   * Get financial dashboard (Super Admin only)
   */
  async getFinancialDashboard(req: AuthRequest, res: Response) {
    try {
      const role = req.user?.role;

      if (role !== "SUPER_ADMIN") {
        return sendError(res, "Only Super Admins can access financial dashboard", 403);
      }

      const dashboard = await financialService.getFinancialDashboard();

      return sendResponse(res, dashboard, "Financial dashboard fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * GET /api/v1/financials/transactions
   * Get all transactions with filters
   */
  async getAllTransactions(req: AuthRequest, res: Response) {
    try {
      const role = req.user?.role;
      const userId = req.user?.id;

      if (!userId || !role) {
        return sendError(res, "Unauthorized", 401);
      }

      const { page, limit, type, startDate, endDate, vendorId } = req.query;

      // Super Admin can see all transactions
      // Vendors can only see their own transactions
      const filters: any = {
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        type: type as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      };

      if (role === "VENDOR") {
        filters.vendorId = userId; // Force vendor to see only their transactions
      } else if (role === "SUPER_ADMIN" && vendorId) {
        filters.vendorId = vendorId as string;
      } else if (role !== "SUPER_ADMIN") {
        return sendError(res, "Unauthorized to view transactions", 403);
      }

      const result = await financialService.getAllTransactions(filters);

      return sendResponse(res, result, "Transactions fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * POST /api/v1/financials/payout
   * Process payout to vendor (Super Admin only)
   */
  async processPayout(req: AuthRequest, res: Response) {
    try {
      const superAdminId = req.user?.id;
      const role = req.user?.role;

      if (!superAdminId || role !== "SUPER_ADMIN") {
        return sendError(res, "Only Super Admins can process payouts", 403);
      }

      const { vendorId, amount, paymentMethod, description } = req.body;

      // Validation
      if (!vendorId || !amount || !paymentMethod) {
        return sendError(res, "vendorId, amount, and paymentMethod are required", 400);
      }

      if (amount <= 0) {
        return sendError(res, "Amount must be greater than 0", 400);
      }

      const result = await financialService.processPayout(superAdminId, {
        vendorId,
        amount,
        paymentMethod,
        description,
      });

      return sendResponse(res, result, "Payout processed successfully", 201);
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * GET /api/v1/financials/statement
   * Get financial statement
   */
  async getStatement(req: AuthRequest, res: Response) {
    try {
      const role = req.user?.role;
      const userId = req.user?.id;

      if (!userId || !role) {
        return sendError(res, "Unauthorized", 401);
      }

      const { vendorId, startDate, endDate } = req.query;

      let targetVendorId: string;

      if (role === "VENDOR") {
        // Vendor can only see their own statement
        targetVendorId = userId;
      } else if (role === "SUPER_ADMIN" && vendorId) {
        // Super Admin can see any vendor's statement
        targetVendorId = vendorId as string;
      } else if (role === "SUPER_ADMIN") {
        return sendError(res, "vendorId is required for Super Admin", 400);
      } else {
        return sendError(res, "Unauthorized to view statement", 403);
      }

      const statement = await financialService.getVendorStatement(
        targetVendorId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      return sendResponse(res, statement, "Financial statement fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * GET /api/v1/financials/stats
   * Get transaction statistics
   */
  async getTransactionStats(req: AuthRequest, res: Response) {
    try {
      const role = req.user?.role;
      const userId = req.user?.id;

      if (!userId || !role) {
        return sendError(res, "Unauthorized", 401);
      }

      const { vendorId } = req.query;

      let targetVendorId: string | undefined;

      if (role === "VENDOR") {
        targetVendorId = userId;
      } else if (role === "SUPER_ADMIN" && vendorId) {
        targetVendorId = vendorId as string;
      } else if (role !== "SUPER_ADMIN") {
        return sendError(res, "Unauthorized to view stats", 403);
      }

      const stats = await financialService.getTransactionStats(targetVendorId);

      return sendResponse(res, stats, "Transaction stats fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }
}

export const financialController = new FinancialController();
