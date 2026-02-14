// src/service/cashfree.service.ts

import crypto from "crypto";
import { cashfreeClient, CASHFREE_API_VERSION } from "../config/cashfree";
import { CreateOrderRequest } from "cashfree-pg";

interface OrderSplit {
    vendor_id: string;
    amount: number;
}

interface CreateOrderParams {
    orderId: string;
    orderAmount: number;
    customerPhone: string;
    customerName: string;
    customerEmail?: string;
    splits: OrderSplit[];
    returnUrl?: string;
    orderNote?: string;
}

interface CreateOrderResult {
    cfOrderId: string;
    paymentSessionId: string;
    orderStatus: string;
}

/**
 * Create an order on Cashfree with optional Easy Split vendors
 */
export const createCashfreeOrder = async (
    params: CreateOrderParams
): Promise<CreateOrderResult> => {
    const orderRequest: CreateOrderRequest = {
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
        order_splits: params.splits as any,
    };

    const response = await cashfreeClient.PGCreateOrder(
        orderRequest
    );

    const data = response.data;

    return {
        cfOrderId: data.cf_order_id || "",
        paymentSessionId: data.payment_session_id || "",
        orderStatus: data.order_status || "ACTIVE",
    };
};

/**
 * Fetch order payments from Cashfree
 */
export const fetchOrderPayments = async (orderId: string) => {
    const response = await cashfreeClient.PGOrderFetchPayments(
        CASHFREE_API_VERSION,
        orderId
    );
    return response.data;
};

/**
 * Verify Cashfree webhook signature using HMAC SHA256
 *
 * @param signature - x-webhook-signature header value
 * @param rawBody - Raw request body string (NOT parsed JSON)
 * @param timestamp - x-webhook-timestamp header value
 * @returns true if signature is valid
 */
export const verifyCashfreeWebhook = (
    signature: string,
    rawBody: string,
    timestamp: string
): boolean => {
    const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET!;
    const message = timestamp + rawBody;
    const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(message)
        .digest("base64");

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
    );
};
