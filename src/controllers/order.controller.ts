// src/controllers/order.controller.ts

import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { createDiaryOrder } from "../service/order.service";
import { Order } from "../models/Order";
import { SplitTransaction } from "../models/SplitTransaction";
import { AppUser } from "../models/Appuser";
import { responseMiddleware } from "../utils/response";
import { HTTP_STATUS } from "../utils/constants";

/**
 * POST /orders/create
 * Any authorized role creates a diary purchase order for a patient.
 * For Assistants, the wallet credit goes to their parent Doctor.
 */
export const createOrder = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        // Resolve the seller (wallet recipient) based on role
        let sellerId = userId;
        if (userRole === "ASSISTANT") {
            const assistant = await AppUser.findByPk(userId, { attributes: ["parentId"] });
            if (!assistant?.parentId) {
                return responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, "Assistant has no parent doctor assigned");
            }
            sellerId = assistant.parentId;
        }

        const { patientId, doctorId, amount, customerPhone, customerName, customerEmail, orderNote, generatedDiaryId } = req.body;

        if (!doctorId) {
            return responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, "Doctor ID could not be resolved");
        }

        if (!patientId || !amount) {
            return responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, "Missing required fields: patientId, amount");
        }

        if (typeof amount !== "number" || amount < 1) {
            return responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, "Amount must be a positive number (minimum ₹1)");
        }

        const result = await createDiaryOrder({
            patientId,
            doctorId,
            vendorId: sellerId,
            generatedDiaryId,
            amount,
            customerPhone: customerPhone || "9999999999",
            customerName: customerName || "Patient",
            customerEmail,
            orderNote,
        });

        return responseMiddleware(res, HTTP_STATUS.CREATED, "Order created successfully", result);
    } catch (error: unknown) {
        console.error("Order creation failed:", error);
        const message = error instanceof Error ? error.message : "Failed to create order";
        return responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
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
    } catch (error: unknown) {
        console.error("Error fetching order:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch order";
        return responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
