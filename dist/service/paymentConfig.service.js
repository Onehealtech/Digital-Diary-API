"use strict";
// src/service/paymentConfig.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateActiveGateway = exports.getPaymentConfig = void 0;
const PaymentConfig_1 = require("../models/PaymentConfig");
const paymentGateway_service_1 = require("./paymentGateway.service");
/**
 * Get the current payment configuration
 */
const getPaymentConfig = async () => {
    let config = await PaymentConfig_1.PaymentConfig.findOne();
    // Auto-seed if no config exists
    if (!config) {
        config = await PaymentConfig_1.PaymentConfig.create({
            activeGateway: "CASHFREE",
        });
    }
    return config;
};
exports.getPaymentConfig = getPaymentConfig;
/**
 * Update the active payment gateway
 */
const updateActiveGateway = async (gateway, updatedBy) => {
    let config = await PaymentConfig_1.PaymentConfig.findOne();
    if (!config) {
        config = await PaymentConfig_1.PaymentConfig.create({
            activeGateway: gateway,
            updatedBy,
        });
    }
    else {
        config.activeGateway = gateway;
        config.updatedBy = updatedBy;
        await config.save();
    }
    // Invalidate the in-memory cache so next request uses the new gateway
    (0, paymentGateway_service_1.invalidateGatewayCache)();
    return config;
};
exports.updateActiveGateway = updateActiveGateway;
