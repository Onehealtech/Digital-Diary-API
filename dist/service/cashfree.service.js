"use strict";
// src/service/cashfree.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCashfreeWebhook = exports.fetchOrderPayments = exports.createCashfreeOrder = void 0;
const crypto_1 = __importDefault(require("crypto"));
const cashfree_1 = require("../config/cashfree");
/**
 * Create an order on Cashfree with optional Easy Split vendors
 */
const createCashfreeOrder = async (params) => {
    const orderRequest = {
        order_id: params.orderId,
        order_amount: params.orderAmount,
        order_currency: "INR",
        customer_details: {
            customer_id: params.orderId,
            customer_phone: params.customerPhone,
            customer_name: params.customerName,
            customer_email: params.customerEmail || "",
        },
        order_meta: {
            return_url: params.returnUrl || "",
        },
        order_note: params.orderNote || "Diary Purchase",
        order_splits: params.splits,
    };
    const response = await cashfree_1.cashfreeClient.PGCreateOrder(orderRequest);
    const data = response.data;
    return {
        cfOrderId: data.cf_order_id || "",
        paymentSessionId: data.payment_session_id || "",
        orderStatus: data.order_status || "ACTIVE",
    };
};
exports.createCashfreeOrder = createCashfreeOrder;
/**
 * Fetch order payments from Cashfree
 */
const fetchOrderPayments = async (orderId) => {
    const response = await cashfree_1.cashfreeClient.PGOrderFetchPayments(cashfree_1.CASHFREE_API_VERSION, orderId);
    return response.data;
};
exports.fetchOrderPayments = fetchOrderPayments;
/**
 * Verify Cashfree webhook signature using HMAC SHA256
 *
 * @param signature - x-webhook-signature header value
 * @param rawBody - Raw request body string (NOT parsed JSON)
 * @param timestamp - x-webhook-timestamp header value
 * @returns true if signature is valid
 */
const verifyCashfreeWebhook = (signature, rawBody, timestamp) => {
    const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET;
    const message = timestamp + rawBody;
    const expectedSignature = crypto_1.default
        .createHmac("sha256", webhookSecret)
        .update(message)
        .digest("base64");
    return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
};
exports.verifyCashfreeWebhook = verifyCashfreeWebhook;
