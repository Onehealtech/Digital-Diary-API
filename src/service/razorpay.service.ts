// src/service/razorpay.service.ts

import crypto from "crypto";
import { getRazorpayInstance, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET } from "../config/razorpay";

interface CreateRazorpayOrderParams {
    orderId: string;
    amount: number; // in INR (will be converted to paise)
    currency?: string;
    notes?: Record<string, string>;
}

interface CreateRazorpayOrderResult {
    razorpayOrderId: string;
    amount: number;
    currency: string;
}

/**
 * Create an order on Razorpay
 * Note: Razorpay expects amount in paise (smallest currency unit)
 */
export const createRazorpayOrder = async (
    params: CreateRazorpayOrderParams
): Promise<CreateRazorpayOrderResult> => {
    const amountInPaise = Math.round(params.amount * 100);

    const order = await getRazorpayInstance().orders.create({
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

/**
 * Verify Razorpay payment signature (client-side callback verification)
 *
 * Razorpay sends: razorpay_order_id, razorpay_payment_id, razorpay_signature
 * Signature = HMAC SHA256(razorpay_order_id + "|" + razorpay_payment_id, key_secret)
 */
export const verifyRazorpayPaymentSignature = (params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
}): boolean => {
    const body = params.razorpayOrderId + "|" + params.razorpayPaymentId;
    const expectedSignature = crypto
        .createHmac("sha256", RAZORPAY_KEY_SECRET)
        .update(body)
        .digest("hex");

    try {
        return crypto.timingSafeEqual(
            Buffer.from(params.razorpaySignature),
            Buffer.from(expectedSignature)
        );
    } catch {
        return false;
    }
};

/**
 * Verify Razorpay webhook signature
 * Signature = HMAC SHA256(rawBody, webhook_secret)
 */
export const verifyRazorpayWebhook = (
    rawBody: string,
    signature: string
): boolean => {
    const expectedSignature = crypto
        .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    } catch {
        return false;
    }
};
