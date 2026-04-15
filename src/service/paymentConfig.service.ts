// src/service/paymentConfig.service.ts

import { PaymentConfig } from "../models/PaymentConfig";
import { invalidateGatewayCache } from "./paymentGateway.service";

/**
 * Get the current payment configuration
 */
export const getPaymentConfig = async () => {
    let config = await PaymentConfig.findOne();

    // Auto-seed if no config exists
    if (!config) {
        config = await PaymentConfig.create({
            activeGateway: "CASHFREE",
        });
    }

    return config;
};

/**
 * Update the active payment gateway
 */
export const updateActiveGateway = async (
    gateway: "CASHFREE" | "RAZORPAY",
    updatedBy: string
) => {
    let config = await PaymentConfig.findOne();

    if (!config) {
        config = await PaymentConfig.create({
            activeGateway: gateway,
            updatedBy,
        });
    } else {
        config.activeGateway = gateway;
        config.updatedBy = updatedBy;
        await config.save();
    }

    // Invalidate the in-memory cache so next request uses the new gateway
    invalidateGatewayCache();

    return config;
};
