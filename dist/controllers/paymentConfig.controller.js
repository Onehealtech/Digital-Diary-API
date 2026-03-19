"use strict";
// src/controllers/paymentConfig.controller.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePaymentConfig = exports.getPaymentConfig = void 0;
const response_1 = require("../utils/response");
const constants_1 = require("../utils/constants");
const paymentConfigService = __importStar(require("../service/paymentConfig.service"));
/**
 * GET /payment-config
 * Returns the current active payment gateway
 */
const getPaymentConfig = async (req, res) => {
    try {
        const config = await paymentConfigService.getPaymentConfig();
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Payment config fetched", {
            activeGateway: config.activeGateway,
            updatedAt: config.updatedAt,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch payment config";
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
exports.getPaymentConfig = getPaymentConfig;
/**
 * PUT /payment-config
 * Updates the active payment gateway
 */
const updatePaymentConfig = async (req, res) => {
    try {
        const { activeGateway } = req.body;
        if (!activeGateway || !["CASHFREE", "RAZORPAY"].includes(activeGateway)) {
            return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, "activeGateway must be 'CASHFREE' or 'RAZORPAY'");
        }
        const config = await paymentConfigService.updateActiveGateway(activeGateway, req.user.id);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, `Payment gateway switched to ${activeGateway}`, {
            activeGateway: config.activeGateway,
            updatedAt: config.updatedAt,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update payment config";
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
exports.updatePaymentConfig = updatePaymentConfig;
