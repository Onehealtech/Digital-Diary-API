"use strict";
// src/routes/wallet.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wallet_controller_1 = require("../controllers/wallet.controller");
const authMiddleware_1 = require("../middleware/authMiddleware");
const constants_1 = require("../utils/constants");
const router = (0, express_1.Router)();
// ─── Any seller role (wallet holders) ─────────────────────────────
const sellerRoles = [constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT];
router.get("/me", (0, authMiddleware_1.authCheck)(sellerRoles), wallet_controller_1.getMyWallet);
router.get("/me/ledger", (0, authMiddleware_1.authCheck)(sellerRoles), wallet_controller_1.getMyLedger);
// ─── SuperAdmin only ───────────────────────────────────────────────
router.get("/all", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), wallet_controller_1.getAllWallets);
router.get("/:userId", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), wallet_controller_1.getUserWallet);
router.post("/:userId/adjust", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), wallet_controller_1.adjustWallet);
router.post("/:userId/payout", (0, authMiddleware_1.authCheck)([constants_1.UserRole.VENDOR, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), wallet_controller_1.requestPayout);
router.post("/:userId/reconcile", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), wallet_controller_1.reconcile);
router.post("/create-payout-order", (0, authMiddleware_1.authCheck)([constants_1.UserRole.VENDOR, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), wallet_controller_1.createPayoutOrder);
router.post("/record-advance", (0, authMiddleware_1.authCheck)([constants_1.UserRole.VENDOR, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), wallet_controller_1.recordAdvance);
exports.default = router;
// In your main app.ts / index.ts:
// import walletRoutes from "./routes/wallet.routes";
// app.use("/api/v1/wallets", walletRoutes);
