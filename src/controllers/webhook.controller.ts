// src/controllers/webhook.controller.ts

import { Request, Response } from "express";
import { WebhookLog } from "../models/WebhookLog";
import { Order } from "../models/Order";
import { verifyCashfreeWebhook } from "../service/cashfree.service";
import { verifyRazorpayWebhook } from "../service/razorpay.service";
import { processPaymentSuccess } from "../service/order.service";
import { activateSubscriptionAfterPayment } from "../service/subscription.service";

/**
 * POST /webhooks/cashfree
 * Receives Cashfree payment webhooks
 *
 * IMPORTANT:
 * - This endpoint does NOT use authCheck — it uses webhook signature verification
 * - Must receive raw body (not parsed JSON) for signature verification
 * - Always returns 200 to Cashfree to prevent retries
 */
export const handleCashfreeWebhook = async (req: Request, res: Response) => {
    const signature = req.headers["x-webhook-signature"] as string;
    const timestamp = req.headers["x-webhook-timestamp"] as string;
    // rawBody must be captured via express middleware (see index.ts setup)
    const rawBody = (req as any).rawBody as string;
    const payload = req.body;

    // Extract order info from webhook payload
    const eventType = payload?.type || "UNKNOWN";
    const orderId = payload?.data?.order?.order_id || null;

    // 1. Log the raw webhook (always, even if verification fails)
    const webhookLog = await WebhookLog.create({
        eventType,
        orderId,
        payload,
        signature: signature || null,
        isVerified: false,
        isProcessed: false,
    });

    try {
        // 2. Verify webhook signature
        if (!signature || !timestamp || !rawBody) {
            console.warn("⚠️ Webhook missing signature/timestamp/body");
            webhookLog.isVerified = false;
            await webhookLog.save();
            return res.status(200).json({ status: "ignored" }); // Still 200 to prevent retries
        }

        const isValid = verifyCashfreeWebhook(signature, rawBody, timestamp);
        webhookLog.isVerified = isValid;

        if (!isValid) {
            console.warn("⚠️ Webhook signature verification failed");
            await webhookLog.save();
            return res.status(200).json({ status: "signature_invalid" });
        }

        // 3. Process based on event type
        if (eventType === "PAYMENT_SUCCESS_WEBHOOK" || eventType === "PAYMENT_SUCCESS") {
            if (!orderId) {
                console.warn("⚠️ Payment success webhook missing orderId");
                await webhookLog.save();
                return res.status(200).json({ status: "missing_order_id" });
            }

            const paymentMethod =
                payload?.data?.payment?.payment_group || "UNKNOWN";

            // Check if this is a subscription order
            const order = await Order.findOne({ where: { orderId } });
            if (order?.subscriptionPlanId) {
                // Subscription payment — activate subscription
                const result = await activateSubscriptionAfterPayment(
                    orderId,
                    paymentMethod,
                    payload?.data?.payment?.cf_payment_id?.toString()
                );

                webhookLog.isProcessed = true;
                await webhookLog.save();

                if (result.alreadyProcessed) {
                    console.log(`ℹ️ Subscription for order ${orderId} already activated (idempotent)`);
                    return res.status(200).json({ status: "already_processed" });
                }

                console.log(`✅ Subscription activated for order ${orderId}`);
                return res.status(200).json({ status: "subscription_activated" });
            }

            // Regular diary order — existing flow
            const result = await processPaymentSuccess(
                orderId,
                paymentMethod,
                payload
            );

            webhookLog.isProcessed = true;
            await webhookLog.save();

            if (result.alreadyProcessed) {
                console.log(`ℹ️ Webhook for order ${orderId} already processed (idempotent)`);
                return res.status(200).json({ status: "already_processed" });
            }

            console.log(`✅ Payment processed for order ${orderId}`);
            return res.status(200).json({ status: "processed" });
        }

        // Non-payment webhook — log and acknowledge
        await webhookLog.save();
        console.log(`ℹ️ Received webhook type: ${eventType}`);
        return res.status(200).json({ status: "acknowledged" });

    } catch (error: any) {
        console.error("❌ Webhook processing error:", error);
        // Still return 200 — we don't want Cashfree to retry on our errors
        // The webhook is logged and can be reprocessed manually
        return res.status(200).json({ status: "error", message: error.message });
    }
};

/**
 * POST /webhooks/razorpay
 * Receives Razorpay payment webhooks
 *
 * IMPORTANT:
 * - No auth — uses webhook signature verification
 * - Always returns 200 to Razorpay to prevent retries
 */
export const handleRazorpayWebhook = async (req: Request, res: Response) => {
    const signature = req.headers["x-razorpay-signature"] as string;
    const rawBody = (req as any).rawBody as string;
    const payload = req.body;

    const eventType = payload?.event || "UNKNOWN";
    // Razorpay sends order receipt in payload.payload.order.entity.receipt
    const receipt = payload?.payload?.payment?.entity?.notes?.orderId
        || payload?.payload?.order?.entity?.receipt
        || null;

    // 1. Log the raw webhook
    const webhookLog = await WebhookLog.create({
        eventType: `RAZORPAY_${eventType}`,
        orderId: receipt,
        payload,
        signature: signature || null,
        isVerified: false,
        isProcessed: false,
    });

    try {
        // 2. Verify webhook signature
        if (!signature || !rawBody) {
            console.warn("⚠️ Razorpay webhook missing signature/body");
            await webhookLog.save();
            return res.status(200).json({ status: "ignored" });
        }

        const isValid = verifyRazorpayWebhook(rawBody, signature);
        webhookLog.isVerified = isValid;

        if (!isValid) {
            console.warn("⚠️ Razorpay webhook signature verification failed");
            await webhookLog.save();
            return res.status(200).json({ status: "signature_invalid" });
        }

        // 3. Process payment.captured event
        if (eventType === "payment.captured") {
            const paymentEntity = payload?.payload?.payment?.entity;
            const razorpayPaymentId = paymentEntity?.id;
            const razorpayOrderId = paymentEntity?.order_id;
            const paymentMethod = paymentEntity?.method || "UNKNOWN";

            // Find the order by gateway order ID
            const order = await Order.findOne({
                where: { cfOrderId: razorpayOrderId }, // cfOrderId stores the gateway order ID
            });

            if (!order) {
                console.warn(`⚠️ Razorpay webhook: Order not found for razorpay order ${razorpayOrderId}`);
                await webhookLog.save();
                return res.status(200).json({ status: "order_not_found" });
            }

            if (order.subscriptionPlanId) {
                // Subscription payment
                const result = await activateSubscriptionAfterPayment(
                    order.orderId,
                    paymentMethod,
                    razorpayPaymentId
                );

                webhookLog.isProcessed = true;
                await webhookLog.save();

                if (result.alreadyProcessed) {
                    console.log(`ℹ️ Razorpay subscription for order ${order.orderId} already activated`);
                    return res.status(200).json({ status: "already_processed" });
                }

                console.log(`✅ Razorpay subscription activated for order ${order.orderId}`);
                return res.status(200).json({ status: "subscription_activated" });
            }

            // Regular diary order
            const result = await processPaymentSuccess(
                order.orderId,
                paymentMethod,
                payload
            );

            webhookLog.isProcessed = true;
            await webhookLog.save();

            if (result.alreadyProcessed) {
                return res.status(200).json({ status: "already_processed" });
            }

            console.log(`✅ Razorpay payment processed for order ${order.orderId}`);
            return res.status(200).json({ status: "processed" });
        }

        // Other events
        await webhookLog.save();
        console.log(`ℹ️ Razorpay webhook event: ${eventType}`);
        return res.status(200).json({ status: "acknowledged" });

    } catch (error: any) {
        console.error("❌ Razorpay webhook error:", error);
        return res.status(200).json({ status: "error", message: error.message });
    }
};
