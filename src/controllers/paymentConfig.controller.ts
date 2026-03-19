// src/controllers/paymentConfig.controller.ts

import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { responseMiddleware } from "../utils/response";
import { HTTP_STATUS } from "../utils/constants";
import * as paymentConfigService from "../service/paymentConfig.service";

/**
 * GET /payment-config
 * Returns the current active payment gateway
 */
export const getPaymentConfig = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const config = await paymentConfigService.getPaymentConfig();
        return responseMiddleware(res, HTTP_STATUS.OK, "Payment config fetched", {
            activeGateway: config.activeGateway,
            updatedAt: config.updatedAt,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to fetch payment config";
        return responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};

/**
 * PUT /payment-config
 * Updates the active payment gateway
 */
export const updatePaymentConfig = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { activeGateway } = req.body;

        if (!activeGateway || !["CASHFREE", "RAZORPAY"].includes(activeGateway)) {
            return responseMiddleware(
                res,
                HTTP_STATUS.BAD_REQUEST,
                "activeGateway must be 'CASHFREE' or 'RAZORPAY'"
            );
        }

        const config = await paymentConfigService.updateActiveGateway(
            activeGateway,
            req.user.id
        );

        return responseMiddleware(res, HTTP_STATUS.OK, `Payment gateway switched to ${activeGateway}`, {
            activeGateway: config.activeGateway,
            updatedAt: config.updatedAt,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to update payment config";
        return responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
