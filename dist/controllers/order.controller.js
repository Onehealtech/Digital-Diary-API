"use strict";
// src/controllers/order.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderStatus = exports.createOrder = void 0;
const order_service_1 = require("../service/order.service");
const Order_1 = require("../models/Order");
const SplitTransaction_1 = require("../models/SplitTransaction");
const Appuser_1 = require("../models/Appuser");
const response_1 = require("../utils/response");
const constants_1 = require("../utils/constants");
/**
 * POST /orders/create
 * Any authorized role creates a diary purchase order for a patient.
 * For Assistants, the wallet credit goes to their parent Doctor.
 */
const createOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        // Resolve the seller (wallet recipient) based on role
        let sellerId = userId;
        if (userRole === "ASSISTANT") {
            const assistant = await Appuser_1.AppUser.findByPk(userId, { attributes: ["parentId"] });
            if (!assistant?.parentId) {
                return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, "Assistant has no parent doctor assigned");
            }
            sellerId = assistant.parentId;
        }
        const { patientId, doctorId, amount, customerPhone, customerName, customerEmail, orderNote, generatedDiaryId } = req.body;
        if (!doctorId) {
            return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, "Doctor ID could not be resolved");
        }
        if (!patientId || !amount) {
            return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, "Missing required fields: patientId, amount");
        }
        if (typeof amount !== "number" || amount < 1) {
            return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, "Amount must be a positive number (minimum ₹1)");
        }
        const result = await (0, order_service_1.createDiaryOrder)({
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
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.CREATED, "Order created successfully", result);
    }
    catch (error) {
        console.error("Order creation failed:", error);
        const message = error instanceof Error ? error.message : "Failed to create order";
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
exports.createOrder = createOrder;
/**
 * GET /orders/:orderId/status
 * Fetch order status and split details
 */
const getOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order_1.Order.findOne({
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
                    model: SplitTransaction_1.SplitTransaction,
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
            return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.NOT_FOUND, "Order not found");
        }
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Order fetched successfully", order);
    }
    catch (error) {
        console.error("Error fetching order:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch order";
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
exports.getOrderStatus = getOrderStatus;
