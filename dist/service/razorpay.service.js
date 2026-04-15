"use strict";
// src/service/razorpay.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRazorpayWebhook = exports.verifyRazorpayPaymentSignature = exports.createRazorpayOrder = void 0;
const crypto_1 = __importDefault(require("crypto"));
const razorpay_1 = require("../config/razorpay");
/**
 * Create an order on Razorpay
 * Note: Razorpay expects amount in paise (smallest currency unit)
 */
const createRazorpayOrder = async (params) => {
    const amountInPaise = Math.round(params.amount * 100);
    const order = await (0, razorpay_1.getRazorpayInstance)().orders.create({
        amount: amountInPaise,
        currency: params.currency || "INR",
        receipt: params.orderId,
        notes: params.notes || {},
    });
    return {
        razorpayOrderId: order.id,
        amount: params.amount,
        currency: params.currency || "INR",
    };
};
exports.createRazorpayOrder = createRazorpayOrder;
/**
 * Verify Razorpay payment signature (client-side callback verification)
 *
 * Razorpay sends: razorpay_order_id, razorpay_payment_id, razorpay_signature
 * Signature = HMAC SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
 */
const verifyRazorpayPaymentSignature = (params) => {
    const body = params.razorpayOrderId + "|" + params.razorpayPaymentId;
    const expectedSignature = crypto_1.default
        .createHmac("sha256", razorpay_1.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest("hex");
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(params.razorpaySignature), Buffer.from(expectedSignature));
    }
    catch {
        return false;
    }
};
exports.verifyRazorpayPaymentSignature = verifyRazorpayPaymentSignature;
/**
 * Verify Razorpay webhook signature
 * Signature = HMAC SHA256(rawBody, webhook_secret)
 */
const verifyRazorpayWebhook = (rawBody, signature) => {
    const expectedSignature = crypto_1.default
        .createHmac("sha256", razorpay_1.RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    }
    catch {
        return false;
    }
};
exports.verifyRazorpayWebhook = verifyRazorpayWebhook;
