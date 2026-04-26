"use strict";
// src/controllers/wallet.controller.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAdvance = exports.createPayoutOrder = exports.reconcile = exports.requestPayout = exports.adjustWallet = exports.getAllWallets = exports.getUserWallet = exports.getMyLedger = exports.getMyWallet = void 0;
const wallet_service_1 = require("../service/wallet.service");
const axios_1 = __importDefault(require("axios"));
const Appuser_1 = require("../models/Appuser");
const uuid_1 = require("uuid");
const UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
/* =========================================================
Get My Wallet
========================================================= */
const getMyWallet = async (req, res) => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const wallet = await (0, wallet_service_1.getWallet)(req.user.id);
        res.json({ success: true, data: wallet });
    }
    catch (error) {
        res.status(404).json({ success: false, message: error.message });
    }
};
exports.getMyWallet = getMyWallet;
/* =========================================================
   Get My Ledger
========================================================= */
const getMyLedger = async (req, res) => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const { page, limit, category, startDate, endDate } = req.query;
        const result = await (0, wallet_service_1.getWalletLedger)({
            userId: req.user.id,
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 20,
            category: category ? String(category) : undefined,
            startDate: startDate ? new Date(String(startDate)) : undefined,
            endDate: endDate ? new Date(String(endDate)) : undefined,
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.getMyLedger = getMyLedger;
/* =========================================================
   SuperAdmin: Get Any User Wallet
========================================================= */
const getUserWallet = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            res.status(400).json({ success: false, message: "userId is required" });
            return;
        }
        const { page, limit, category, startDate, endDate } = req.query;
        const result = await (0, wallet_service_1.getWalletLedger)({
            userId,
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 20,
            category: category ? String(category) : undefined,
            startDate: startDate ? new Date(String(startDate)) : undefined,
            endDate: endDate ? new Date(String(endDate)) : undefined,
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.getUserWallet = getUserWallet;
/* =========================================================
   SuperAdmin: All Wallets
========================================================= */
const getAllWallets = async (req, res) => {
    try {
        const result = await (0, wallet_service_1.getAllWalletsSummary)();
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAllWallets = getAllWallets;
/* =========================================================
   SuperAdmin: Manual Adjustment
========================================================= */
const adjustWallet = async (req, res) => {
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
        const result = await (0, wallet_service_1.manualAdjustment)({
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
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.adjustWallet = adjustWallet;
/* =========================================================
   SuperAdmin: Initiate Payout
========================================================= */
const requestPayout = async (req, res) => {
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
        const payout = await (0, wallet_service_1.initiatePayout)({
            userId,
            amount: numericAmount,
            performedBy: req.user?.id || "SYSTEM",
        });
        res.json({
            success: true,
            message: `Payout of ₹${numericAmount} initiated`,
            data: payout,
        });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.requestPayout = requestPayout;
/* =========================================================
   SuperAdmin: Reconcile
========================================================= */
const reconcile = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            res.status(400).json({ success: false, message: "userId required" });
            return;
        }
        const result = await (0, wallet_service_1.reconcileWallet)(userId);
        res.json({
            success: true,
            message: result ? "Balance corrected from ledger" : "Balance is accurate",
            data: result,
        });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.reconcile = reconcile;
const createPayoutOrder = async (req, res) => {
    try {
        const userId = req.user?.id;
        const UserData = await Appuser_1.AppUser.findOne({ where: { id: userId } });
        if (!UserData) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }
        const amount = Number(req.body.amount);
        if (isNaN(amount) || amount <= 0) {
            res.status(400).json({ success: false, message: "A positive amount is required" });
            return;
        }
        const orderId = `payout_${(0, uuid_1.v3)(`${userId}_${Date.now()}`, UUID_NAMESPACE)}`;
        const baseUrl = process.env.CASHFREE_ENV === "PRODUCTION"
            ? "https://api.cashfree.com/pg/orders"
            : "https://sandbox.cashfree.com/pg/orders";
        const response = await axios_1.default.post(baseUrl, {
            order_id: orderId,
            order_amount: amount,
            order_currency: "INR",
            order_note: "Wallet Payout",
            order_meta: { return_url: "" },
            customer_details: {
                customer_id: UserData.id,
                customer_phone: UserData.phone || "9999999999",
                customer_name: UserData.fullName,
                customer_email: UserData.email || "",
            },
        }, {
            headers: {
                "x-api-version": "2023-08-01",
                "x-client-id": process.env.CASHFREE_APP_ID,
                "x-client-secret": process.env.CASHFREE_SECRET_KEY,
            },
        });
        console.log("Payout order created:", response.data);
        res.json({
            success: true,
            paymentSessionId: response.data.payment_session_id,
            orderId,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Payment init failed", error: error instanceof Error ? error.message : String(error) });
    }
};
exports.createPayoutOrder = createPayoutOrder;
const recordAdvance = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { amount, paymentMethod, paymentReference, notes } = req.body;
        if (!amount || amount <= 0) {
            res.status(400).json({ success: false, message: "A positive amount is required" });
            return;
        }
        if (!paymentMethod) {
            res.status(400).json({ success: false, message: "paymentMethod is required (BANK_TRANSFER, UPI, CASH, CHEQUE)" });
            return;
        }
        const result = await (0, wallet_service_1.recordAdvancePayment)({
            vendorId,
            amount,
            paymentMethod,
            paymentReference,
            performedBy: req.user.id,
            notes,
        });
        res.json({
            success: true,
            message: `₹${amount} advance recorded`,
            data: {
                balance: result.wallet.balance,
                transactionId: result.transaction.id,
            },
        });
    }
    catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};
exports.recordAdvance = recordAdvance;
