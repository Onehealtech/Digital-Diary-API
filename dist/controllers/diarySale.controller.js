"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPhoneOtp = exports.sendPhoneOtp = exports.markFundTransferred = exports.getMyDiaryRequests = exports.requestDiaries = exports.getMySales = exports.getMyInventory = exports.sellDiary = void 0;
const AppError_1 = require("../utils/AppError");
const diarySale_service_1 = require("../service/diarySale.service");
const diarySale_schemas_1 = require("../schemas/diarySale.schemas");
const twilio_service_1 = require("../service/twilio.service");
const otpService_1 = require("../service/otpService");
const zod_1 = require("zod");
/**
 * POST /api/v1/diary-sales/sell
 * Sell a diary — available to SUPER_ADMIN, VENDOR, DOCTOR, ASSISTANT
 */
const sellDiary = async (req, res) => {
    try {
        const parsed = diarySale_schemas_1.sellDiarySchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, message: parsed.error.issues[0].message });
            return;
        }
        const user = req.user;
        const sellerRole = user.role;
        // Assistant permission check
        // if (sellerRole === "ASSISTANT") {
        //   const permissions = user.permissions || {};
        //   if (!permissions.sellDiary) {
        //     res.status(403).json({ success: false, message: "You do not have permission to sell diaries" });
        //     return;
        //   }
        // }
        const result = await diarySale_service_1.diarySaleService.sellDiary({
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
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Sell diary error:", error);
        // Surface the actual error so the frontend can display a useful message
        const userMessage = error?.original?.detail
            || error?.errors?.[0]?.message
            || message
            || "Failed to sell diary";
        res.status(500).json({ success: false, message: userMessage });
    }
};
exports.sellDiary = sellDiary;
/**
 * GET /api/v1/diary-sales/inventory
 * Get available diaries for the current user
 */
const getMyInventory = async (req, res) => {
    try {
        const user = req.user;
        const { page, limit, search } = req.query;
        const result = await diarySale_service_1.diarySaleService.getInventory(user.id, user.role, {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            search: search,
        });
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Get inventory error:", message);
        res.status(500).json({ success: false, message: "Failed to fetch inventory" });
    }
};
exports.getMyInventory = getMyInventory;
/**
 * GET /api/v1/diary-sales/my-sales
 * Get sales history for the current user
 */
const getMySales = async (req, res) => {
    try {
        const user = req.user;
        const { page, limit, status } = req.query;
        console.log(user, "user");
        const result = await diarySale_service_1.diarySaleService.getSales(user.id, user.role, {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            status: status,
        });
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Get sales error:", message);
        res.status(500).json({ success: false, message: "Failed to fetch sales" });
    }
};
exports.getMySales = getMySales;
/**
 * POST /api/v1/diary-sales/request
 * Request diaries from SuperAdmin (VENDOR or DOCTOR)
 */
const requestDiaries = async (req, res) => {
    try {
        const parsed = diarySale_schemas_1.requestDiariesSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ success: false, message: parsed.error.issues[0].message });
            return;
        }
        const user = req.user;
        const role = user.role;
        const result = await diarySale_service_1.diarySaleService.requestDiaries(user.id, role, parsed.data.quantity, parsed.data.message, parsed.data.diaryType);
        res.status(201).json({
            success: true,
            message: "Diary request submitted successfully",
            data: result,
        });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Request diaries error:", message);
        res.status(500).json({ success: false, message: "Failed to submit diary request" });
    }
};
exports.requestDiaries = requestDiaries;
/**
 * GET /api/v1/diary-sales/requests
 * Get diary requests for the current user
 */
const getMyDiaryRequests = async (req, res) => {
    try {
        const user = req.user;
        const { page, limit, status } = req.query;
        const result = await diarySale_service_1.diarySaleService.getMyDiaryRequests(user.id, user.role, {
            page: page ? Number(page) : undefined,
            limit: limit ? Number(limit) : undefined,
            status: status,
        });
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Get diary requests error:", message);
        res.status(500).json({ success: false, message: "Failed to fetch diary requests" });
    }
};
exports.getMyDiaryRequests = getMyDiaryRequests;
/**
 * PUT /api/v1/diary-sales/:diaryId/mark-transferred
 * Mark a diary sale as fund transferred
 */
const markFundTransferred = async (req, res) => {
    try {
        const diaryId = req.params.diaryId;
        if (!diaryId) {
            res.status(400).json({ success: false, message: "Diary ID is required" });
            return;
        }
        const userId = req.user.id;
        const result = await diarySale_service_1.diarySaleService.markFundTransferred(diaryId, userId);
        res.status(200).json({ success: true, message: result.message, data: result });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Mark fund transferred error:", message);
        res.status(500).json({ success: false, message: "Failed to mark fund as transferred" });
    }
};
exports.markFundTransferred = markFundTransferred;
// ── Phone OTP for diary selling ─────────────────────────────────────
const sendPhoneOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
});
const verifyPhoneOtpSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
    otp: zod_1.z.string().min(4, "OTP is required"),
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
//     const sent = await twilioService.sendOTP(phone, otp);
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
const sendPhoneOtp = async (req, res) => {
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
        const otp = (0, otpService_1.generateOTP)(key);
        const sent = await twilio_service_1.twilioService.sendOTP(phone, otp);
        if (!sent) {
            res.status(500).json({ success: false, message: "Failed to send OTP. Please try again." });
            return;
        }
        res.status(200).json({ success: true, message: "OTP sent successfully" });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Send phone OTP error:", message);
        res.status(500).json({ success: false, message: "Failed to send OTP" });
    }
};
exports.sendPhoneOtp = sendPhoneOtp;
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
const verifyPhoneOtp = async (req, res) => {
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
        }
        else {
            valid = (0, otpService_1.verifyOTP)(key, otp);
        }
        if (!valid) {
            res.status(400).json({ success: false, message: "Invalid or expired OTP" });
            return;
        }
        res.status(200).json({ success: true, message: "Phone number verified successfully" });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Verify phone OTP error:", message);
        res.status(500).json({ success: false, message: "Failed to verify OTP" });
    }
};
exports.verifyPhoneOtp = verifyPhoneOtp;
