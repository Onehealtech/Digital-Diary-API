"use strict";
// src/service/paymentGateway.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentOrder = exports.invalidateGatewayCache = exports.getActiveGateway = void 0;
const PaymentConfig_1 = require("../models/PaymentConfig");
const cashfree_service_1 = require("./cashfree.service");
const razorpay_service_1 = require("./razorpay.service");
const razorpay_1 = require("../config/razorpay");
// Simple in-memory cache (60s TTL)
let cachedGateway = null;
/**
 * Get the currently active payment gateway from DB (cached 60s)
 */
const getActiveGateway = async () => {
    const now = Date.now();
    if (cachedGateway && cachedGateway.expiresAt > now) {
        return cachedGateway.value;
    }
    const config = await PaymentConfig_1.PaymentConfig.findOne();
    const gateway = config?.activeGateway || "CASHFREE";
    cachedGateway = { value: gateway, expiresAt: now + 60000 };
    return gateway;
};
exports.getActiveGateway = getActiveGateway;
/**
 * Invalidate the gateway cache (call after admin updates config)
 */
const invalidateGatewayCache = () => {
    cachedGateway = null;
};
exports.invalidateGatewayCache = invalidateGatewayCache;
/**
 * Create a payment order using the currently active gateway.
 * Returns gateway-specific details the frontend needs to open the checkout.
 */
const createPaymentOrder = async (params) => {
    const gateway = await (0, exports.getActiveGateway)();
    if (gateway === "RAZORPAY") {
        const result = await (0, razorpay_service_1.createRazorpayOrder)({
            orderId: params.orderId,
            amount: params.amount,
            currency: params.currency,
            notes: {
                orderId: params.orderId,
                customerName: params.customerName,
                ...(params.notes || {}),
            },
        });
        return {
            gateway: "RAZORPAY",
            gatewayOrderId: result.razorpayOrderId,
            razorpayKeyId: razorpay_1.RAZORPAY_KEY_ID,
        };
    }
    // Default: Cashfree
    const result = await (0, cashfree_service_1.createCashfreeOrder)({
        orderId: params.orderId,
        orderAmount: params.amount,
        customerPhone: params.customerPhone,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        splits: [],
        orderNote: params.orderNote || "Subscription Payment",
    });
    return {
        gateway: "CASHFREE",
        gatewayOrderId: result.cfOrderId,
        paymentSessionId: result.paymentSessionId,
    };
};
exports.createPaymentOrder = createPaymentOrder;
