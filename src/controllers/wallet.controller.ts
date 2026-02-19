// src/controllers/wallet.controller.ts

import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

import {
  getWallet,
  getWalletLedger,
  getAllWalletsSummary,
  manualAdjustment,
  initiatePayout,
  reconcileWallet,
} from "../service/wallet.service";
import { v4 as uuid } from "uuid";
import axios from "axios";
import { AppUser } from "../models/Appuser";
/* =========================================================
   Get My Wallet
========================================================= */

export const getMyWallet = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const wallet = await getWallet(req.user.id);

    res.json({ success: true, data: wallet });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
  }
};

/* =========================================================
   Get My Ledger
========================================================= */

export const getMyLedger = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { page, limit, category, startDate, endDate } = req.query;

    const result = await getWalletLedger({
      userId: req.user.id,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      category: category ? String(category) : undefined,
      startDate: startDate ? new Date(String(startDate)) : undefined,
      endDate: endDate ? new Date(String(endDate)) : undefined,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/* =========================================================
   SuperAdmin: Get Any User Wallet
========================================================= */

export const getUserWallet = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ success: false, message: "userId is required" });
      return;
    }

    const { page, limit, category, startDate, endDate } = req.query;

    const result = await getWalletLedger({
      userId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      category: category ? String(category) : undefined,
      startDate: startDate ? new Date(String(startDate)) : undefined,
      endDate: endDate ? new Date(String(endDate)) : undefined,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/* =========================================================
   SuperAdmin: All Wallets
========================================================= */

export const getAllWallets = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await getAllWalletsSummary();
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================================================
   SuperAdmin: Manual Adjustment
========================================================= */

export const adjustWallet = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { type, amount, description } = req.body;

    if (!userId || !type || !amount || !description) {
      res.status(400).json({
        success: false,
        message: "userId, type, amount, description are required",
      });
      return;
    }

    if (!["CREDIT", "DEBIT"].includes(type)) {
      res.status(400).json({
        success: false,
        message: "type must be CREDIT or DEBIT",
      });
      return;
    }

    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      res.status(400).json({
        success: false,
        message: "Amount must be positive number",
      });
      return;
    }

    const result = await manualAdjustment({
      userId,
      type,
      amount: numericAmount,
      description,
      performedBy: req.user?.id || "SYSTEM",
    });

    res.json({
      success: true,
      message: `Wallet ${type.toLowerCase()}ed ₹${numericAmount}`,
      data: {
        newBalance: result.wallet.balance,
        transactionId: result.transaction.id,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/* =========================================================
   SuperAdmin: Initiate Payout
========================================================= */

export const requestPayout = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { amount } = req.body;

    if (!userId || !amount) {
      res.status(400).json({
        success: false,
        message: "userId and amount are required",
      });
      return;
    }

    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      res.status(400).json({
        success: false,
        message: "Amount must be positive number",
      });
      return;
    }

    const payout = await initiatePayout({
      userId,
      amount: numericAmount,
      performedBy: req.user?.id || "SYSTEM",
    });

    res.json({
      success: true,
      message: `Payout of ₹${numericAmount} initiated`,
      data: payout,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/* =========================================================
   SuperAdmin: Reconcile
========================================================= */

export const reconcile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ success: false, message: "userId required" });
      return;
    }

    const result = await reconcileWallet(userId);

    res.json({
      success: true,
      message: result ? "Balance corrected from ledger" : "Balance is accurate",
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const createPayoutOrder = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
  
    const userId = req.user?.id;
    const UserData = await AppUser.findOne({ where: { id: userId } });

    if (!UserData) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
    const { amount }:any = req.body;

    const orderId = `payout_${uuid()}`;

    const response = await axios.post(
      "https://sandbox.cashfree.com/pg/orders",
      {
        order_id: orderId,
        order_amount: amount,
        order_currency: "INR",
        customer_details: {
          customer_id: UserData.id,
          customer_phone: UserData.phone,
          customer_name: UserData.fullName,
        },
      },
      {
        headers: {
          "x-api-version": "2023-08-01",
          "x-client-id": process.env.CASHFREE_APP_ID,
          "x-client-secret": process.env.CASHFREE_SECRET_KEY,
        },
      }
    ).then((response) => {
      res.json({
        success: true,
        paymentSessionId: response.data.payment_session_id,
        orderId,
      });
    }).catch((error) => {
      console.error("Error creating payout order:", error);
      res.status(500).json({ success: false, message: "Failed to create payout order" });
    });

  } catch (error) {
    res.status(500).json({ success: false, message: "Payment init failed", error: error instanceof Error ? error.message : String(error) });
  }
};