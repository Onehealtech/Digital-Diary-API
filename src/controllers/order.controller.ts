// src/controllers/order.controller.ts

import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { createDiaryOrder } from "../service/order.service";
import { Order } from "../models/Order";
import { SplitTransaction } from "../models/SplitTransaction";
import { responseMiddleware } from "../utils/response";
import { API_MESSAGES, HTTP_STATUS } from "../utils/constants";

/**
 * POST /orders/create
 * Doctor or Assistant creates a diary purchase order for a patient
 *
 * Amount is passed from backend product definition — NOT from frontend.
 * Split is calculated server-side from active SplitConfig.
 */
export const createOrder = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const vendorId = req.user.id; // Vendor ID is derived from the authenticated user (Doctor or Assistant's parentId if Assistant)

        const { patientId,doctorId, amount, customerPhone, customerName, customerEmail, orderNote , generatedDiaryId} = req.body;
        
        // Resolve doctorId — if Assistant, use parentId
        
        if (!doctorId) {
            return responseMiddleware(
                res,
                HTTP_STATUS.BAD_REQUEST,
                "Doctor ID could not be resolved"
            );
        }

        if (!patientId || !vendorId || !amount) {
            return responseMiddleware(
                res,
                HTTP_STATUS.BAD_REQUEST,
                "Missing required fields: patientId, vendorId, amount"
            );
        }

        if (typeof amount !== "number" || amount < 1) {
            return responseMiddleware(
                res,
                HTTP_STATUS.BAD_REQUEST,
                "Amount must be a positive number (minimum ₹1)"
            );
        }

        const result = await createDiaryOrder({
            patientId,
            doctorId,
            vendorId,
            generatedDiaryId, // Will be generated in service
            amount,
            customerPhone: customerPhone || "9999999999",
            customerName: customerName || "Patient",
            customerEmail,
            orderNote,
        });

        return responseMiddleware(
            res,
            HTTP_STATUS.CREATED,
            "Order created successfully",
            result
        );
    } catch (error: any) {
        console.error("❌ Order creation failed:", error);
        return responseMiddleware(
            res,
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            error.message || "Failed to create order"
        );
    }
};

/**
 * GET /orders/:orderId/status
 * Fetch order status and split details
 */
export const getOrderStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findOne({
            where: { orderId },
            attributes: [
                "orderId",
                "cfOrderId",
                "amount",
                "currency",
                "status",
                "paymentMethod",
                "paidAt",
                "createdAt",
            ],
            include: [
                {
                    model: SplitTransaction,
                    attributes: [
                        "vendorAmount",
                        "doctorAmount",
                        "platformAmount",
                        "splitType",
                        "transferStatus",
                        "processedAt",
                    ],
                },
            ],
        });

        if (!order) {
            return responseMiddleware(
                res,
                HTTP_STATUS.NOT_FOUND,
                "Order not found"
            );
        }

        return responseMiddleware(
            res,
            HTTP_STATUS.OK,
            "Order fetched successfully",
            order
        );
    } catch (error: any) {
        console.error("❌ Error fetching order:", error);
        return responseMiddleware(
            res,
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
            error.message || "Failed to fetch order"
        );
    }
};
