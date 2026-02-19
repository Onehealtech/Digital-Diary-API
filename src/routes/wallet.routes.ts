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

// ─── Any authenticated user ────────────────────────────────────────
router.get("/me", authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR]), getMyWallet);
router.get("/me/ledger", authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR]), getMyLedger);

// ─── SuperAdmin only ───────────────────────────────────────────────
router.get("/all", authCheck([UserRole.SUPER_ADMIN]), getAllWallets);
router.get("/:userId", authCheck([UserRole.SUPER_ADMIN]), getUserWallet);
router.post("/:userId/adjust", authCheck([UserRole.SUPER_ADMIN]), adjustWallet);
router.post("/:userId/payout", authCheck([UserRole.VENDOR]), requestPayout);
router.post("/:userId/reconcile", authCheck([UserRole.SUPER_ADMIN]), reconcile);
router.post("/create-payout-order", authCheck([UserRole.VENDOR]), createPayoutOrder);
router.post("/record-advance", authCheck([UserRole.VENDOR]), recordAdvance);

export default router;

// In your main app.ts / index.ts:
// import walletRoutes from "./routes/wallet.routes";
// app.use("/api/v1/wallets", walletRoutes);