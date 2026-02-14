// src/controllers/earnings.controller.ts

import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { getVendorEarnings, getDoctorEarnings } from "../service/order.service";
import { responseMiddleware } from "../utils/response";
import { HTTP_STATUS } from "../utils/constants";

/**
 * GET /vendor/earnings
 * Vendor views their earnings (scoped to own vendorId)
 * Optional query params: startDate, endDate
 */
export const vendorEarnings = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    try {
        const vendorId = req.user.id;
        const { startDate, endDate } = req.query;

        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        const result = await getVendorEarnings(vendorId, start, end);

        return responseMiddleware(
            res,
            HttpStatusCode.OK,
            "Vendor earnings fetched successfully",
            result
        );
    } catch (error: any) {
        console.error("❌ Error fetching vendor earnings:", error);
        return responseMiddleware(
            res,
            HttpStatusCode.INTERNAL_SERVER_ERROR,
            error.message || "Failed to fetch earnings"
        );
    }
};

/**
 * GET /doctor/earnings
 * Doctor views their earnings (scoped to own doctorId)
 * Optional query params: startDate, endDate
 */
export const doctorEarnings = async (
    req: AuthenticatedRequest,
    res: Response
) => {
    try {
        const doctorId = req.user.id;
        const { startDate, endDate } = req.query;

        const start = startDate ? new Date(startDate as string) : undefined;
        const end = endDate ? new Date(endDate as string) : undefined;

        const result = await getDoctorEarnings(doctorId, start, end);

        return responseMiddleware(
            res,
            HttpStatusCode.OK,
            "Doctor earnings fetched successfully",
            result
        );
    } catch (error: any) {
        console.error("❌ Error fetching doctor earnings:", error);
        return responseMiddleware(
            res,
            HttpStatusCode.INTERNAL_SERVER_ERROR,
            error.message || "Failed to fetch earnings"
        );
    }
};
