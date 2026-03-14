"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const constants_1 = require("../utils/constants");
const diarySale_controller_1 = require("../controllers/diarySale.controller");
const router = (0, express_1.Router)();
// POST /api/v1/diary-sales/sell — Sell diary (all roles)
router.post("/sell", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), diarySale_controller_1.sellDiary);
// GET /api/v1/diary-sales/inventory — Get available diaries for current user
router.get("/inventory", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), diarySale_controller_1.getMyInventory);
// GET /api/v1/diary-sales/my-sales — Get sales history for current user
router.get("/my-sales", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), diarySale_controller_1.getMySales);
// POST /api/v1/diary-sales/request — Request diaries from SuperAdmin (Vendor, Doctor, or Assistant)
router.post("/request", (0, authMiddleware_1.authCheck)([constants_1.UserRole.VENDOR, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), diarySale_controller_1.requestDiaries);
// PUT /api/v1/diary-sales/:diaryId/mark-transferred — Mark fund as transferred
router.put("/:diaryId/mark-transferred", (0, authMiddleware_1.authCheck)([constants_1.UserRole.VENDOR, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), diarySale_controller_1.markFundTransferred);
// GET /api/v1/diary-sales/requests — Get my diary requests
router.get("/requests", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), diarySale_controller_1.getMyDiaryRequests);
exports.default = router;
