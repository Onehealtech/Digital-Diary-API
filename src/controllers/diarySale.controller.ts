import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { AppError } from "../utils/AppError";
import { diarySaleService } from "../service/diarySale.service";
import { sellDiarySchema, requestDiariesSchema } from "../schemas/diarySale.schemas";
import { sendOTP } from "../service/smsfortius.service";
import { generateOTP, verifyOTP } from "../service/otpService";
import { z } from "zod";

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
    // if (sellerRole === "ASSISTANT") {
    //   const permissions = user.permissions || {};
    //   if (!permissions.sellDiary) {
    //     res.status(403).json({ success: false, message: "You do not have permission to sell diaries" });
    //     return;
    //   }
    // }

    const result = await diarySaleService.sellDiary({
      ...parsed.data,
      sellerId: user.id,
      sellerRole,
    });

    res.status(201).json({
      success: true,
      message: "Diary sold successfully. Pending Super Admin approval.",
      data: result,
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Sell diary error:", error);
    // Surface the actual error so the frontend can display a useful message
    const userMessage = (error as any)?.original?.detail
      || (error as any)?.errors?.[0]?.message
      || message
      || "Failed to sell diary";
    res.status(500).json({ success: false, message: userMessage });
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
    console.log(user,"user");
    
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

/**
 * PUT /api/v1/diary-sales/:diaryId/mark-transferred
 * Mark a diary sale as fund transferred
 */
export const markFundTransferred = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const diaryId = req.params.diaryId as string;

    if (!diaryId) {
      res.status(400).json({ success: false, message: "Diary ID is required" });
      return;
    }

    const userId = req.user!.id;
    const result = await diarySaleService.markFundTransferred(diaryId, userId);

    res.status(200).json({ success: true, message: result.message, data: result });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Mark fund transferred error:", message);
    res.status(500).json({ success: false, message: "Failed to mark fund as transferred" });
  }
};

// ── Phone OTP for diary selling ─────────────────────────────────────

const sendPhoneOtpSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
});

const verifyPhoneOtpSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
  otp: z.string().min(4, "OTP is required"),
});

/**
 * POST /api/v1/diary-sales/send-phone-otp
 * Send OTP to patient's phone number during diary selling
 */
// export const sendPhoneOtp = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
//   try {
//     const parsed = sendPhoneOtpSchema.safeParse(req.body);
//     if (!parsed.success) {
//       res.status(400).json({ success: false, message: parsed.error.issues[0].message });
//       return;
//     }

//     const { phone } = parsed.data;
//     const key = `sell-phone-${phone}`;
//     const otp = generateOTP(key);

//     const sent = await sendOTP(phone, otp);
//     if (!sent) {
//       res.status(500).json({ success: false, message: "Failed to send OTP. Please try again." });
//       return;
//     }

//     res.status(200).json({ success: true, message: "OTP sent successfully" });
//   } catch (error: unknown) {
//     const message = error instanceof Error ? error.message : "Unknown error";
//     console.error("Send phone OTP error:", message);
//     res.status(500).json({ success: false, message: "Failed to send OTP" });
//   }
// };
export const sendPhoneOtp = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = sendPhoneOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: parsed.error.issues[0].message });
      return;
    }

    const { phone } = parsed.data;

    // ✅ FALLBACK MODE
    if (process.env.FALLBACK_OTP === "true") {
       res.status(200).json({
        success: true,
        message: "OTP sent successfully (DEV MODE)",
        otp: "123456", // optional (for testing)
      });
      return;
    }

    const key = `sell-phone-${phone}`;
    const otp = generateOTP(key);

    const sent = await sendOTP(phone, otp);
    if (!sent) {
      res.status(500).json({ success: false, message: "Failed to send OTP. Please try again." });
      return;
    }

    res.status(200).json({ success: true, message: "OTP sent successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Send phone OTP error:", message);
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};
/**
 * POST /api/v1/diary-sales/verify-phone-otp
 * Verify OTP for patient's phone number during diary selling
 */
// export const verifyPhoneOtp = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
//   try {
//     const parsed = verifyPhoneOtpSchema.safeParse(req.body);
//     if (!parsed.success) {
//       res.status(400).json({ success: false, message: parsed.error.issues[0].message });
//       return;
//     }

//     const { phone, otp } = parsed.data;
//     const key = `sell-phone-${phone}`;
//     const valid = verifyOTP(key, otp);

//     if (!valid) {
//       res.status(400).json({ success: false, message: "Invalid or expired OTP" });
//       return;
//     }

//     res.status(200).json({ success: true, message: "Phone number verified successfully" });
//   } catch (error: unknown) {
//     const message = error instanceof Error ? error.message : "Unknown error";
//     console.error("Verify phone OTP error:", message);
//     res.status(500).json({ success: false, message: "Failed to verify OTP" });
//   }
// };

export const verifyPhoneOtp = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const parsed = verifyPhoneOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: parsed.error.issues[0].message });
      return;
    }

    const { phone, otp } = parsed.data;
    const key = `sell-phone-${phone}`;

    let valid = false;

    // ✅ FALLBACK MODE (STATIC OTP)
    if (process.env.FALLBACK_OTP === "true") {
      valid = otp === "123456";
    } else {
      valid = verifyOTP(key, otp);
    }

    if (!valid) {
      res.status(400).json({ success: false, message: "Invalid or expired OTP" });
      return;
    }

    res.status(200).json({ success: true, message: "Phone number verified successfully" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Verify phone OTP error:", message);
    res.status(500).json({ success: false, message: "Failed to verify OTP" });
  }
};
