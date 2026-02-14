// src/service/order.service.ts

import crypto from "crypto";
import { sequelize } from "../config/Dbconnetion";
import { Order } from "../models/Order";
import { SplitConfig } from "../models/SplitConfig";
import { SplitTransaction } from "../models/SplitTransaction";
import { WebhookLog } from "../models/WebhookLog";
import { AppUser } from "../models/Appuser";
import { Patient } from "../models/Patient";
import { calculateSplit } from "./split.service";
import { createCashfreeOrder } from "./cashfree.service";

interface CreateOrderParams {
    patientId: string;
    doctorId: string;
    vendorId: string;
    amount: number;
    customerPhone: string;
    customerName: string;
    customerEmail?: string;
    orderNote?: string;
}

/**
 * Generate a unique, deterministic order ID
 */
const generateOrderId = (): string => {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString("hex");
    return `ORD-${timestamp}-${random}`.toUpperCase();
};

/**
 * Create a diary purchase order with split configuration
 *
 * Flow:
 * 1. Validate vendor + doctor exist
 * 2. Fetch active split config
 * 3. Calculate split amounts
 * 4. Create Cashfree order with Easy Split vendors
 * 5. Save Order + SplitTransaction in a DB transaction
 */
export const createDiaryOrder = async (params: CreateOrderParams) => {
    const { patientId, doctorId, vendorId, amount, customerPhone, customerName, customerEmail, orderNote } = params;

    // 1. Validate vendor exists and has cashfreeVendorId
    const vendor = await AppUser.findByPk(vendorId);
    if (!vendor) {
        throw new Error("Vendor not found");
    }

    const doctor = await AppUser.findByPk(doctorId);
    if (!doctor) {
        throw new Error("Doctor not found");
    }

    // 2. Fetch active split config
    const splitConfig = await SplitConfig.findOne({
        where: { isActive: true },
    });
    if (!splitConfig) {
        throw new Error("No active split configuration found. Contact SuperAdmin.");
    }

    // 3. Calculate split amounts (uses Decimal.js)
    const splitAmounts = calculateSplit(amount, {
        splitType: splitConfig.splitType,
        vendorValue: splitConfig.vendorValue,
        doctorValue: splitConfig.doctorValue,
    });

    // 4. Generate order ID and create Cashfree order
    const orderId = generateOrderId();
    const idempotencyKey = `split-${orderId}`;

    // Build Cashfree Easy Split vendor array
    const cashfreeSplits = [
        {
            vendor_id: vendorId, // Must match Cashfree vendor ID
            amount: parseFloat(splitAmounts.vendorAmount),
        },
        {
            vendor_id: doctorId, // Must match Cashfree vendor ID
            amount: parseFloat(splitAmounts.doctorAmount),
        },
    ];

    // 5. Create Cashfree order
    const cashfreeResult = await createCashfreeOrder({
        orderId,
        orderAmount: amount,
        customerPhone,
        customerName,
        customerEmail,
        splits: cashfreeSplits,
        orderNote,
    });

    // 6. Save everything in a DB transaction (atomic)
    const result = await sequelize.transaction(async (t) => {
        const order = await Order.create(
            {
                orderId,
                cfOrderId: cashfreeResult.cfOrderId,
                patientId,
                doctorId,
                vendorId,
                amount,
                currency: "INR",
                status: "PENDING",
                paymentSessionId: cashfreeResult.paymentSessionId,
                orderNote,
            },
            { transaction: t }
        );

        const splitTxn = await SplitTransaction.create(
            {
                orderId: order.id,
                totalAmount: amount,
                vendorAmount: splitAmounts.vendorAmount,
                doctorAmount: splitAmounts.doctorAmount,
                platformAmount: splitAmounts.platformAmount,
                splitType: splitConfig.splitType,
                transferStatus: "PENDING",
                idempotencyKey,
            },
            { transaction: t }
        );

        return { order, splitTxn };
    });

    return {
        orderId: result.order.orderId,
        cfOrderId: result.order.cfOrderId,
        paymentSessionId: result.order.paymentSessionId,
        amount,
        currency: "INR",
        status: result.order.status,
        split: {
            vendorAmount: splitAmounts.vendorAmount,
            doctorAmount: splitAmounts.doctorAmount,
            platformAmount: splitAmounts.platformAmount,
            splitType: splitConfig.splitType,
        },
    };
};

/**
 * Process a successful payment webhook
 *
 * - Checks idempotency (skip if already processed)
 * - Updates Order status to PAID
 * - Updates SplitTransaction status to SUCCESS
 * - All within a DB transaction
 */
export const processPaymentSuccess = async (
    orderId: string,
    paymentMethod: string,
    webhookPayload: object
) => {
    return await sequelize.transaction(async (t) => {
        // Find the order by our orderId (not Cashfree's cfOrderId)
        const order = await Order.findOne({
            where: { orderId },
            transaction: t,
            lock: t.LOCK.UPDATE, // Pessimistic lock to prevent race conditions
        });

        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        // Idempotency check — skip if already paid
        if (order.status === "PAID") {
            console.log(`⚠️ Order ${orderId} already marked as PAID, skipping`);
            return { order, alreadyProcessed: true };
        }

        // Update order status
        order.status = "PAID";
        order.paymentMethod = paymentMethod;
        order.paidAt = new Date();
        await order.save({ transaction: t });

        // Update split transaction
        const splitTxn = await SplitTransaction.findOne({
            where: { orderId: order.id },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (splitTxn) {
            splitTxn.transferStatus = "SUCCESS";
            splitTxn.processedAt = new Date();
            await splitTxn.save({ transaction: t });
        }

        return { order, splitTxn, alreadyProcessed: false };
    });
};

/**
 * Get vendor earnings with optional date range
 */
export const getVendorEarnings = async (
    vendorId: string,
    startDate?: Date,
    endDate?: Date
) => {
    const whereClause: any = {
        vendorId,
        status: "PAID",
    };

    if (startDate && endDate) {
        const { Op } = require("sequelize");
        whereClause.paidAt = {
            [Op.between]: [startDate, endDate],
        };
    }

    const orders = await Order.findAll({
        where: whereClause,
        include: [
            {
                model: SplitTransaction,
                attributes: ["vendorAmount", "totalAmount", "splitType", "processedAt"],
            },
        ],
        attributes: ["orderId", "amount", "status", "paidAt", "paymentMethod"],
        order: [["paidAt", "DESC"]],
    });

    // Calculate totals
    const { Sequelize } = require("sequelize");
    const totals = await SplitTransaction.findOne({
        attributes: [
            [Sequelize.fn("SUM", Sequelize.col("vendorAmount")), "totalEarnings"],
            [Sequelize.fn("COUNT", Sequelize.col("id")), "totalOrders"],
        ],
        include: [
            {
                model: Order,
                where: { vendorId, status: "PAID" },
                attributes: [],
            },
        ],
        raw: true,
    });

    return { orders, totals };
};

/**
 * Get doctor earnings with optional date range
 */
export const getDoctorEarnings = async (
    doctorId: string,
    startDate?: Date,
    endDate?: Date
) => {
    const whereClause: any = {
        doctorId,
        status: "PAID",
    };

    if (startDate && endDate) {
        const { Op } = require("sequelize");
        whereClause.paidAt = {
            [Op.between]: [startDate, endDate],
        };
    }

    const orders = await Order.findAll({
        where: whereClause,
        include: [
            {
                model: SplitTransaction,
                attributes: ["doctorAmount", "totalAmount", "splitType", "processedAt"],
            },
        ],
        attributes: ["orderId", "amount", "status", "paidAt", "paymentMethod"],
        order: [["paidAt", "DESC"]],
    });

    const { Sequelize } = require("sequelize");
    const totals = await SplitTransaction.findOne({
        attributes: [
            [Sequelize.fn("SUM", Sequelize.col("doctorAmount")), "totalEarnings"],
            [Sequelize.fn("COUNT", Sequelize.col("id")), "totalOrders"],
        ],
        include: [
            {
                model: Order,
                where: { doctorId, status: "PAID" },
                attributes: [],
            },
        ],
        raw: true,
    });

    return { orders, totals };
};
