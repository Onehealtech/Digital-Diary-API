import { Request, Response } from "express";
import { VendorService } from "../service/vendor.service";
import { sendResponse, sendError } from "../utils/response";

const vendorService = new VendorService();

export class VendorController {
  /**
   * GET /api/vendors - List all vendors
   */
  async getAllVendors(req: Request, res: Response) {
    try {
      const { page, limit, search, location, status } = req.query;

      const result = await vendorService.getAllVendors({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        location: location as string,
        status: status as string,
      });

      return sendResponse(res, 200, "Vendors retrieved successfully", result);
    } catch (error: any) {
      return sendError(res, 500, "Failed to retrieve vendors", error.message);
    }
  }

  /**
   * GET /api/vendors/:id - Get vendor by ID
   */
  async getVendorById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const vendor = await vendorService.getVendorById(id);

      return sendResponse(res, 200, "Vendor retrieved successfully", vendor);
    } catch (error: any) {
      return sendError(res, 404, error.message);
    }
  }

  /**
   * POST /api/vendors - Create new vendor
   */
  async createVendor(req: Request, res: Response) {
    try {
      const {
        fullName,
        email,
        phone,
        password,
        businessName,
        location,
        gst,
        bankDetails,
        commissionRate,
      } = req.body;

      // Validation
      if (
        !fullName ||
        !email ||
        !password ||
        !businessName ||
        !location ||
        !gst ||
        !bankDetails
      ) {
        return sendError(res, 400, "Missing required fields");
      }

      const result = await vendorService.createVendor({
        fullName,
        email,
        phone,
        password,
        businessName,
        location,
        gst,
        bankDetails,
        commissionRate,
      });

      return sendResponse(res, 201, "Vendor created successfully", result);
    } catch (error: any) {
      return sendError(res, 500, "Failed to create vendor", error.message);
    }
  }

  /**
   * PUT /api/vendors/:id - Update vendor
   */
  async updateVendor(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const updates = req.body;

      const result = await vendorService.updateVendor(id, updates);

      return sendResponse(res, 200, "Vendor updated successfully", result);
    } catch (error: any) {
      return sendError(res, 500, "Failed to update vendor", error.message);
    }
  }

  /**
   * GET /api/vendors/:id/wallet - Get vendor wallet
   */
  async getVendorWallet(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { page, limit } = req.query;

      const result = await vendorService.getVendorWallet(
        id,
        page ? parseInt(page as string) : undefined,
        limit ? parseInt(limit as string) : undefined
      );

      return sendResponse(
        res,
        200,
        "Wallet information retrieved successfully",
        result
      );
    } catch (error: any) {
      return sendError(res, 500, "Failed to retrieve wallet", error.message);
    }
  }

  /**
   * POST /api/vendors/:id/wallet/transfer - Transfer funds to vendor
   */
  async transferFunds(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { amount, description } = req.body;
      const processedBy = (req as any).user.id; // From auth middleware

      if (!amount || amount <= 0) {
        return sendError(res, 400, "Invalid amount");
      }

      const result = await vendorService.transferFunds(
        id,
        amount,
        processedBy,
        description
      );

      return sendResponse(
        res,
        200,
        "Funds transferred successfully",
        result
      );
    } catch (error: any) {
      return sendError(res, 500, "Failed to transfer funds", error.message);
    }
  }

  /**
   * GET /api/vendors/:id/sales - Get vendor sales history
   */
  async getVendorSales(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { page, limit, startDate, endDate, status } = req.query;

      const result = await vendorService.getVendorSales(id, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        status: status as string,
      });

      return sendResponse(
        res,
        200,
        "Sales history retrieved successfully",
        result
      );
    } catch (error: any) {
      return sendError(
        res,
        500,
        "Failed to retrieve sales history",
        error.message
      );
    }
  }

  /**
   * GET /api/vendors/:id/inventory - Get vendor inventory
   */
  async getVendorInventory(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { page, limit, status } = req.query;

      const result = await vendorService.getVendorInventory(id, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as string,
      });

      return sendResponse(
        res,
        200,
        "Inventory retrieved successfully",
        result
      );
    } catch (error: any) {
      return sendError(res, 500, "Failed to retrieve inventory", error.message);
    }
  }

  /**
   * POST /api/vendors/:id/sell-diary - Sell diary to patient
   */
  async sellDiary(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const {
        diaryId,
        patientName,
        age,
        gender,
        phone,
        address,
        doctorId,
        paymentAmount,
      } = req.body;

      // Validation
      if (
        !diaryId ||
        !patientName ||
        !age ||
        !gender ||
        !phone ||
        !address ||
        !doctorId ||
        !paymentAmount
      ) {
        return sendError(res, 400, "Missing required fields");
      }

      const result = await vendorService.sellDiary({
        vendorId: id,
        diaryId,
        patientName,
        age,
        gender,
        phone,
        address,
        doctorId,
        paymentAmount,
      });

      return sendResponse(
        res,
        201,
        "Diary sold successfully. Awaiting Super Admin approval.",
        result
      );
    } catch (error: any) {
      return sendError(res, 500, "Failed to sell diary", error.message);
    }
  }

  /**
   * GET /api/vendors/:id/dashboard - Get vendor dashboard stats
   */
  async getVendorDashboard(req: Request, res: Response) {
    try {
      const id = req.params.id as string;

      const result = await vendorService.getVendorDashboard(id);

      return sendResponse(
        res,
        200,
        "Dashboard data retrieved successfully",
        result
      );
    } catch (error: any) {
      return sendError(
        res,
        500,
        "Failed to retrieve dashboard data",
        error.message
      );
    }
  }
}
