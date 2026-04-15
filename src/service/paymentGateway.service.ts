// src/service/paymentGateway.service.ts

import { PaymentConfig } from "../models/PaymentConfig";
import { createCashfreeOrder } from "./cashfree.service";
import { createRazorpayOrder } from "./razorpay.service";
import { RAZORPAY_KEY_ID } from "../config/razorpay";

type Gateway = "CASHFREE" | "RAZORPAY";

// Simple in-memory cache (60s TTL)
let cachedGateway: { value: Gateway; expiresAt: number } | null = null;

/**
 * Get the currently active payment gateway from DB (cached 60s)
 */
export const getActiveGateway = async (): Promise<Gateway> => {
    const now = Date.now();
    if (cachedGateway && cachedGateway.expiresAt > now) {
        return cachedGateway.value;
    }

    const config = await PaymentConfig.findOne();
    const gateway = config?.activeGateway || "CASHFREE";

    cachedGateway = { value: gateway, expiresAt: now + 60_000 };
    return gateway;
};

/**
 * Invalidate the gateway cache (call after admin updates config)
 */
export const invalidateGatewayCache = () => {
    cachedGateway = null;
};

interface CreatePaymentOrderParams {
    orderId: string;
    amount: number;
    currency?: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    notes?: Record<string, string>;
    orderNote?: string;
}

interface CreatePaymentOrderResult {
    gateway: Gateway;
    gatewayOrderId: string;
    // Cashfree-specific
    paymentSessionId?: string;
    // Razorpay-specific
    razorpayKeyId?: string;
}

/**
 * Create a payment order using the currently active gateway.
 * Returns gateway-specific details the frontend needs to open the checkout.
 */
export const createPaymentOrder = async (
    params: CreatePaymentOrderParams
): Promise<CreatePaymentOrderResult> => {
    const gateway = await getActiveGateway();

    if (gateway === "RAZORPAY") {
        const result = await createRazorpayOrder({
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
            razorpayKeyId: RAZORPAY_KEY_ID,
        };
    }

    // Default: Cashfree
    const result = await createCashfreeOrder({
        orderId: params.orderId,
        orderAmount: params.amount,
        customerPhone: params.customerPhone,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        splits: [], // No split for subscription orders
        orderNote: params.orderNote || "Subscription Payment",
    });

    return {
        gateway: "CASHFREE",
        gatewayOrderId: result.cfOrderId,
        paymentSessionId: result.paymentSessionId,
    };
};
