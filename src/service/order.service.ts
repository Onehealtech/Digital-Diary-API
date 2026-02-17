// src/service/order.service.ts

import crypto from "crypto";
import { Op } from "sequelize";
import { Sequelize } from "sequelize";
import { sequelize } from "../config/Dbconnetion";
import { Order } from "../models/Order";
import { SplitConfig } from "../models/SplitConfig";
import { SplitTransaction } from "../models/SplitTransaction";
import { WebhookLog } from "../models/WebhookLog";
import { AppUser } from "../models/Appuser";
import { Patient } from "../models/Patient";
import { calculateSplit, validateSplitConfig } from "./split.service";
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
 * Generate a unique order ID
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
 * 1. Validate patient, vendor, and doctor exist
 * 2. Fetch active split config
 * 3. Validate split config against order amount
 * 4. Calculate split amounts
 * 5. Create Cashfree order with Easy Split (using Cashfree vendor IDs)
 * 6. Save Order + SplitTransaction atomically
 *
 * Money flow:
 *   Patient pays full amount → Cashfree holds it
 *   → Cashfree splits to vendor (cashfreeVendorId) + doctor (cashfreeVendorId)
 *   → Platform remainder stays with Super Admin's Cashfree account
 */
export const createDiaryOrder = async (params: CreateOrderParams) => {
    const {
        patientId,
        doctorId,
        vendorId,
        amount,
        customerPhone,
        customerName,
        customerEmail,
        orderNote,
    } = params;

    // ── 1. Validate all parties exist ──────────────────────────────────

    const patient = await Patient.findByPk(patientId);
    if (!patient) {
        throw new Error("Patient not found");
    }

    const vendor = await AppUser.findByPk(vendorId);
    if (!vendor) {
        throw new Error("Vendor not found");
    }
    if (!vendor.cashfreeVendorId) {
        throw new Error(
            "Vendor is not registered with Cashfree. Contact SuperAdmin to complete vendor onboarding."
        );
    }

    const doctor = await AppUser.findByPk(doctorId);
    if (!doctor) {
        throw new Error("Doctor not found");
    }
    if (!doctor.cashfreeVendorId) {
        throw new Error(
            "Doctor is not registered with Cashfree. Contact SuperAdmin to complete doctor onboarding."
        );
    }

    // ── 2. Fetch active split config ───────────────────────────────────

    const splitConfig = await SplitConfig.findOne({
        where: { isActive: true },
    });
    if (!splitConfig) {
        throw new Error(
            "No active split configuration found. Contact SuperAdmin."
        );
    }

    // ── 3. Validate split config against the order amount ──────────────

    const validation = validateSplitConfig(
        {
            splitType: splitConfig.splitType,
            vendorValue: splitConfig.vendorValue,
            doctorValue: splitConfig.doctorValue,
        },
        amount
    );

    if (!validation.isValid) {
        throw new Error(
            `Split configuration invalid: ${validation.errors.join("; ")}`
        );
    }

    // ── 4. Calculate split amounts (Decimal.js precision) ──────────────

    const splitAmounts = calculateSplit(amount, {
        splitType: splitConfig.splitType,
        vendorValue: splitConfig.vendorValue,
        doctorValue: splitConfig.doctorValue,
    });

    // ── 5. Create Cashfree order ───────────────────────────────────────

    const orderId = generateOrderId();
    const idempotencyKey = `split-${orderId}`;

    // IMPORTANT: Use Cashfree-registered vendor IDs, NOT internal DB IDs
    const cashfreeSplits = [
        {
            vendor_id: vendor.cashfreeVendorId,
            amount: Number(splitAmounts.vendorAmount), // Number() is safer than parseFloat for decimal strings
        },
        {
            vendor_id: doctor.cashfreeVendorId,
            amount: Number(splitAmounts.doctorAmount),
        },
    ];

    const cashfreeResult = await createCashfreeOrder({
        orderId,
        orderAmount: amount,
        customerPhone,
        customerName,
        customerEmail,
        splits: cashfreeSplits,
        orderNote,
    });

    // ── 6. Save to DB atomically ───────────────────────────────────────

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
 * - Pessimistic lock prevents duplicate processing
 * - Idempotent: safe to call multiple times for the same order
 * - Updates Order → PAID, SplitTransaction → SUCCESS
 */
export const processPaymentSuccess = async (
    orderId: string,
    paymentMethod: string,
    webhookPayload: object
) => {
    return await sequelize.transaction(async (t) => {
        const order = await Order.findOne({
            where: { orderId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }

        // Idempotency: skip if already processed
        if (order.status === "PAID") {
            console.log(`Order ${orderId} already marked as PAID, skipping`);
            return { order, alreadyProcessed: true };
        }

        // Update order
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

        // Log the webhook payload for audit
        await WebhookLog.create(
            {
                orderId: order.id,
                eventType: "PAYMENT_SUCCESS",
                payload: webhookPayload,
                processedAt: new Date(),
            },
            { transaction: t }
        );

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
        whereClause.paidAt = {
            [Op.between]: [startDate, endDate],
        };
    }

    const orders = await Order.findAll({
        where: whereClause,
        include: [
            {
                model: SplitTransaction,
                attributes: [
                    "vendorAmount",
                    "totalAmount",
                    "splitType",
                    "processedAt",
                ],
            },
        ],
        attributes: ["orderId", "amount", "status", "paidAt", "paymentMethod"],
        order: [["paidAt", "DESC"]],
    });

    const totals = await SplitTransaction.findOne({
        attributes: [
            [Sequelize.fn("SUM", Sequelize.col("vendorAmount")), "totalEarnings"],
            [Sequelize.fn("COUNT", Sequelize.col("SplitTransaction.id")), "totalOrders"],
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
        whereClause.paidAt = {
            [Op.between]: [startDate, endDate],
        };
    }

    const orders = await Order.findAll({
        where: whereClause,
        include: [
            {
                model: SplitTransaction,
                attributes: [
                    "doctorAmount",
                    "totalAmount",
                    "splitType",
                    "processedAt",
                ],
            },
        ],
        attributes: ["orderId", "amount", "status", "paidAt", "paymentMethod"],
        order: [["paidAt", "DESC"]],
    });

    const totals = await SplitTransaction.findOne({
        attributes: [
            [Sequelize.fn("SUM", Sequelize.col("doctorAmount")), "totalEarnings"],
            [Sequelize.fn("COUNT", Sequelize.col("SplitTransaction.id")), "totalOrders"],
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