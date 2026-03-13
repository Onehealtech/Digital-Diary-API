import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { AppError } from "../utils/AppError";
import { diarySaleService } from "../service/diarySale.service";
import { sellDiarySchema, requestDiariesSchema } from "../schemas/diarySale.schemas";

/**
 * POST /api/v1/diary-sales/sell
 * Sell a diary — available to SUPER_ADMIN, VENDOR, DOCTOR, ASSISTANT
 */
export const sellDiary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = sellDiarySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: parsed.error.issues[0].message });
      return;
    }

    const user = req.user!;
    const sellerRole = user.role as "SUPER_ADMIN" | "VENDOR" | "DOCTOR" | "ASSISTANT";

    // Assistant permission check
    if (sellerRole === "ASSISTANT") {
      const permissions = user.permissions || {};
      if (!permissions.sellDiary) {
        res.status(403).json({ success: false, message: "You do not have permission to sell diaries" });
        return;
      }
    }

    const result = await diarySaleService.sellDiary({
      ...parsed.data,
      sellerId: user.id,
      sellerRole,
    });

    res.status(201).json({
      success: true,
      message: sellerRole === "SUPER_ADMIN"
        ? "Diary sold and activated successfully"
        : "Diary sold successfully. Pending SuperAdmin approval.",
      data: result,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Sell diary error:", message);
    res.status(500).json({ success: false, message: "Failed to sell diary" });
  }
};

/**
 * GET /api/v1/diary-sales/inventory
 * Get available diaries for the current user
 */
export const getMyInventory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { page, limit, search } = req.query;

    const result = await diarySaleService.getInventory(user.id, user.role, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search: search as string | undefined,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Get inventory error:", message);
    res.status(500).json({ success: false, message: "Failed to fetch inventory" });
  }
};

/**
 * GET /api/v1/diary-sales/my-sales
 * Get sales history for the current user
 */
export const getMySales = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { page, limit, status } = req.query;

    const result = await diarySaleService.getSales(user.id, user.role, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status: status as string | undefined,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Get sales error:", message);
    res.status(500).json({ success: false, message: "Failed to fetch sales" });
  }
};

/**
 * POST /api/v1/diary-sales/request
 * Request diaries from SuperAdmin (VENDOR or DOCTOR)
 */
export const requestDiaries = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = requestDiariesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: parsed.error.issues[0].message });
      return;
    }

    const user = req.user!;
    const role = user.role as "VENDOR" | "DOCTOR";

    const result = await diarySaleService.requestDiaries(
      user.id,
      role,
      parsed.data.quantity,
      parsed.data.message,
      parsed.data.diaryType
    );

    res.status(201).json({
      success: true,
      message: "Diary request submitted successfully",
      data: result,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Request diaries error:", message);
    res.status(500).json({ success: false, message: "Failed to submit diary request" });
  }
};

/**
 * GET /api/v1/diary-sales/requests
 * Get diary requests for the current user
 */
export const getMyDiaryRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { page, limit, status } = req.query;

    const result = await diarySaleService.getMyDiaryRequests(user.id, user.role, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status: status as string | undefined,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Get diary requests error:", message);
    res.status(500).json({ success: false, message: "Failed to fetch diary requests" });
  }
};
