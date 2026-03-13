// src/routes/wallet.routes.ts

import { Router } from "express";

import {
  getMyWallet,
  getMyLedger,
  getUserWallet,
  getAllWallets,
  adjustWallet,
  requestPayout,
  reconcile,
  createPayoutOrder,
  recordAdvance,
} from "../controllers/wallet.controller";
import { authCheck } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

const router = Router();

// ─── Any seller role (wallet holders) ─────────────────────────────
const sellerRoles = [UserRole.SUPER_ADMIN, UserRole.VENDOR, UserRole.DOCTOR, UserRole.ASSISTANT];
router.get("/me", authCheck(sellerRoles), getMyWallet);
router.get("/me/ledger", authCheck(sellerRoles), getMyLedger);

// ─── SuperAdmin only ───────────────────────────────────────────────
router.get("/all", authCheck([UserRole.SUPER_ADMIN]), getAllWallets);
router.get("/:userId", authCheck([UserRole.SUPER_ADMIN]), getUserWallet);
router.post("/:userId/adjust", authCheck([UserRole.SUPER_ADMIN]), adjustWallet);
router.post("/:userId/payout", authCheck([UserRole.VENDOR, UserRole.DOCTOR]), requestPayout);
router.post("/:userId/reconcile", authCheck([UserRole.SUPER_ADMIN]), reconcile);
router.post("/create-payout-order", authCheck([UserRole.VENDOR, UserRole.DOCTOR, UserRole.ASSISTANT]), createPayoutOrder);
router.post("/record-advance", authCheck([UserRole.VENDOR, UserRole.DOCTOR, UserRole.ASSISTANT]), recordAdvance);

export default router;

// In your main app.ts / index.ts:
// import walletRoutes from "./routes/wallet.routes";
// app.use("/api/v1/wallets", walletRoutes);