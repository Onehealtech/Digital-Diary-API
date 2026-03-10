"use strict";
// src/controllers/earnings.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorEarnings = exports.vendorEarnings = void 0;
const order_service_1 = require("../service/order.service");
const response_1 = require("../utils/response");
const constants_1 = require("../utils/constants");
/**
 * GET /vendor/earnings
 * Vendor views their earnings (scoped to own vendorId)
 * Optional query params: startDate, endDate
 */
const vendorEarnings = async (req, res) => {
    try {
        const vendorId = req.user.id;
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;
        const result = await (0, order_service_1.getVendorEarnings)(vendorId, start, end);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Vendor earnings fetched successfully", result);
    }
    catch (error) {
        console.error("❌ Error fetching vendor earnings:", error);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message || "Failed to fetch earnings");
    }
};
exports.vendorEarnings = vendorEarnings;
/**
 * GET /doctor/earnings
 * Doctor views their earnings (scoped to own doctorId)
 * Optional query params: startDate, endDate
 */
const doctorEarnings = async (req, res) => {
    try {
        const doctorId = req.user.id;
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : undefined;
        const end = endDate ? new Date(endDate) : undefined;
        const result = await (0, order_service_1.getDoctorEarnings)(doctorId, start, end);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Doctor earnings fetched successfully", result);
    }
    catch (error) {
        console.error("❌ Error fetching doctor earnings:", error);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message || "Failed to fetch earnings");
    }
};
exports.doctorEarnings = doctorEarnings;
