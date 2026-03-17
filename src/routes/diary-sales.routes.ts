import { Router } from "express";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";
import {
  sellDiary,
  getMyInventory,
  getMySales,
  requestDiaries,
  getMyDiaryRequests,
  markFundTransferred,
  sendPhoneOtp,
  verifyPhoneOtp,
} from "../controllers/diarySale.controller";

const router = Router();

// POST /api/v1/diary-sales/send-phone-otp — Send OTP to patient phone during selling
router.post(
  "/send-phone-otp",
  authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR, UserRole.DOCTOR, UserRole.ASSISTANT]),
  sendPhoneOtp
);

// POST /api/v1/diary-sales/verify-phone-otp — Verify patient phone OTP during selling
router.post(
  "/verify-phone-otp",
  authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR, UserRole.DOCTOR, UserRole.ASSISTANT]),
  verifyPhoneOtp
);

// POST /api/v1/diary-sales/sell — Sell diary (all roles)
router.post(
  "/sell",
  authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR, UserRole.DOCTOR, UserRole.ASSISTANT]),
  sellDiary
);

// GET /api/v1/diary-sales/inventory — Get available diaries for current user
router.get(
  "/inventory",
  authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR, UserRole.DOCTOR, UserRole.ASSISTANT]),
  getMyInventory
);

// GET /api/v1/diary-sales/my-sales — Get sales history for current user
router.get(
  "/my-sales",
  authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR, UserRole.DOCTOR, UserRole.ASSISTANT]),
  getMySales
);

// POST /api/v1/diary-sales/request — Request diaries from SuperAdmin (Vendor, Doctor, or Assistant)
router.post(
  "/request",
  authCheck([UserRole.VENDOR, UserRole.DOCTOR, UserRole.ASSISTANT]),
  requestDiaries
);

// PUT /api/v1/diary-sales/:diaryId/mark-transferred — Mark fund as transferred
router.put(
  "/:diaryId/mark-transferred",
  authCheck([UserRole.VENDOR, UserRole.DOCTOR, UserRole.ASSISTANT]),
  markFundTransferred
);

// GET /api/v1/diary-sales/requests — Get my diary requests
router.get(
  "/requests",
  authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR, UserRole.DOCTOR, UserRole.ASSISTANT]),
  getMyDiaryRequests
);

export default router;
