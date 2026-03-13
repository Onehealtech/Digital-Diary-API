import { Router } from "express";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";
import {
  sellDiary,
  getMyInventory,
  getMySales,
  requestDiaries,
  getMyDiaryRequests,
} from "../controllers/diarySale.controller";

const router = Router();

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

// GET /api/v1/diary-sales/requests — Get my diary requests
router.get(
  "/requests",
  authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR, UserRole.DOCTOR, UserRole.ASSISTANT]),
  getMyDiaryRequests
);

export default router;
