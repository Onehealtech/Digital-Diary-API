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
import { creditWallet, creditWalletsOnSale } from "./wallet.service";
import { Diary } from "../models/Diary";
import { GeneratedDiary } from "../models/GeneratedDiary";

interface CreateOrderParams {
    patientId: string;
    doctorId: string;
    vendorId: string;
    amount: number;
    generatedDiaryId: string;
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
// export const createDiaryOrder = async (params: CreateOrderParams) => {
//     const {
//         patientId,
//         doctorId,
//         vendorId,
//         amount,
//         customerPhone,
//         customerName,
//         customerEmail,
//         orderNote,
//     } = params;

//     // ── 1. Validate all parties exist ──────────────────────────────────

//     const patient = await Patient.findByPk(patientId);
//     if (!patient) {
//         throw new Error("Patient not found");
//     }

//     const vendor = await AppUser.findByPk(vendorId);
//     if (!vendor) {
//         throw new Error("Vendor not found");
//     }
//     if (!vendor.cashfreeVendorId) {
//         throw new Error(
//             "Vendor is not registered with Cashfree. Contact SuperAdmin to complete vendor onboarding."
//         );
//     }

//     const doctor = await AppUser.findByPk(doctorId);
//     if (!doctor) {
//         throw new Error("Doctor not found");
//     }
//     if (!doctor.cashfreeVendorId) {
//         throw new Error(
//             "Doctor is not registered with Cashfree. Contact SuperAdmin to complete doctor onboarding."
//         );
//     }

//     // ── 2. Fetch active split config ───────────────────────────────────

//     const splitConfig = await SplitConfig.findOne({
//         where: { isActive: true },
//     });
//     if (!splitConfig) {
//         throw new Error(
//             "No active split configuration found. Contact SuperAdmin."
//         );
//     }

//     // ── 3. Validate split config against the order amount ──────────────

//     const validation = validateSplitConfig(
//         {
//             splitType: splitConfig.splitType,
//             vendorValue: splitConfig.vendorValue,
//             doctorValue: splitConfig.doctorValue,
//         },
//         amount
//     );

//     if (!validation.isValid) {
//         throw new Error(
//             `Split configuration invalid: ${validation.errors.join("; ")}`
//         );
//     }

//     // ── 4. Calculate split amounts (Decimal.js precision) ──────────────

//     const splitAmounts = calculateSplit(amount, {
//         splitType: splitConfig.splitType,
//         vendorValue: splitConfig.vendorValue,
//         doctorValue: splitConfig.doctorValue,
//     });

//     // ── 5. Create Cashfree order ───────────────────────────────────────

//     const orderId = generateOrderId();
//     const idempotencyKey = `split-${orderId}`;

//     // IMPORTANT: Use Cashfree-registered vendor IDs, NOT internal DB IDs
//     const cashfreeSplits = [
//         {
//             vendor_id: vendor.cashfreeVendorId,
//             amount: Number(splitAmounts.vendorAmount), // Number() is safer than parseFloat for decimal strings
//         },
//         {
//             vendor_id: doctor.cashfreeVendorId,
//             amount: Number(splitAmounts.doctorAmount),
//         },
//     ];

//     const cashfreeResult = await createCashfreeOrder({
//         orderId,
//         orderAmount: amount,
//         customerPhone,
//         customerName,
//         customerEmail,
//         splits: cashfreeSplits,
//         orderNote,
//     });

//     // ── 6. Save to DB atomically ───────────────────────────────────────

//     const result = await sequelize.transaction(async (t) => {
//         const order = await Order.create(
//             {
//                 orderId,
//                 cfOrderId: cashfreeResult.cfOrderId,
//                 patientId,
//                 doctorId,
//                 vendorId,
//                 amount,
//                 currency: "INR",
//                 status: "PENDING",
//                 paymentSessionId: cashfreeResult.paymentSessionId,
//                 orderNote,
//             },
//             { transaction: t }
//         );

//         const splitTxn = await SplitTransaction.create(
//             {
//                 orderId: order.id,
//                 totalAmount: amount,
//                 vendorAmount: splitAmounts.vendorAmount,
//                 doctorAmount: splitAmounts.doctorAmount,
//                 platformAmount: splitAmounts.platformAmount,
//                 splitType: splitConfig.splitType,
//                 transferStatus: "PENDING",
//                 idempotencyKey,
//             },
//             { transaction: t }
//         );
//         if (splitTxn) {
//             splitTxn.transferStatus = "SUCCESS";
//             splitTxn.processedAt = new Date();
//             await splitTxn.save({ transaction: t });

//             // ─── Credit all 3 wallets ────────────────────────────────────
//             // Find the platform SuperAdmin (parent or first SUPER_ADMIN)
//             const platformAdmin = await AppUser.findOne({
//                 where: { role: "SUPER_ADMIN" },
//                 transaction: t,
//             });

//             if (platformAdmin) {
//                 await creditWalletsOnSale({
//                     orderId: order.orderId,
//                     vendorId: order.vendorId,
//                     doctorId: order.doctorId,
//                     platformUserId: platformAdmin.id,
//                     vendorAmount: splitTxn.vendorAmount,
//                     doctorAmount: splitTxn.doctorAmount,
//                     platformAmount: splitTxn.platformAmount,
//                     transaction: t,
//                 });
//             }
//         }
//         return { order, splitTxn };
//     });

//     return {
//         orderId: result.order.orderId,
//         cfOrderId: result.order.cfOrderId,
//         paymentSessionId: result.order.paymentSessionId,
//         amount,
//         currency: "INR",
//         status: result.order.status,
//         split: {
//             vendorAmount: splitAmounts.vendorAmount,
//             doctorAmount: splitAmounts.doctorAmount,
//             platformAmount: splitAmounts.platformAmount,
//             splitType: splitConfig.splitType,
//         },
//     };
// };
export const createDiaryOrder = async (params: CreateOrderParams) => {
    const {
        patientId,
        doctorId,
        vendorId,
        amount,
        generatedDiaryId,
        customerPhone,
        customerName,
        customerEmail,
        orderNote,
    } = params;

    // 1️⃣ Validate entities
    const patient = await Patient.findByPk(patientId);
    if (!patient) throw new Error("Patient not found");

    const vendor = await AppUser.findByPk(vendorId);
    if (!vendor) throw new Error("Vendor not found");

    const doctor = await AppUser.findByPk(doctorId);
    if (!doctor) throw new Error("Doctor not found");

    // 2️⃣ Generate Order ID
    const orderId = generateOrderId();

    // 3️⃣ Create Cashfree order WITHOUT split
    //   const cashfreeResult = await createCashfreeOrder({
    //     orderId,
    //     orderAmount: amount,
    //     customerPhone,
    //     customerName,
    //     customerEmail,
    //     splits: [], // ✅ SPLIT DISABLED
    //     orderNote,
    //   });

    // 4️⃣ Save Order + Credit Vendor Wallet
    const result = await sequelize.transaction(async (t) => {
        const order = await Order.create(
            {
                orderId,
                cfOrderId: "",
                patientId,
                doctorId,
                vendorId,
                amount,
                currency: "INR",
                status: "PAID", // Directly mark as PAID (or use webhook)
                paymentSessionId: "",
                paidAt: new Date(),
            },
            { transaction: t }
        );
         await Diary.create(
            {   id:generatedDiaryId,
                patientId,
                doctorId,
                vendorId,
                status: "pending",
                activationDate: null,
                approvedBy: null,
                approvedAt: null,
                saleAmount: amount,
                commissionAmount: 0,
            },
            { transaction: t }
        );
        const generateDiaryId = await GeneratedDiary.findOne({
            where: { id: generatedDiaryId },
            transaction: t,
        });
        if (generateDiaryId) {
            generateDiaryId.status = "sold";
            await generateDiaryId.save({ transaction: t });
        }
        // ✅ CREDIT FULL AMOUNT TO VENDOR WALLET
        await creditWallet({
            userId: vendorId,
            amount: amount,
            category: "DIARY_SALE",
            description: `Diary sale - Order ${orderId}`,
            referenceType: "ORDER",
            referenceId: orderId,
            transaction: t,
        });

        return order;
    });

    return {
        orderId: result.orderId,
        amount,
        status: "PAID",
        message: "Order created and vendor wallet credited",
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

        if (!order) throw new Error(`Order ${orderId} not found`);

        // Idempotency
        if (order.status === "PAID") {
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

            // Credit wallets — all 3 parties
            const platformAdmin = await AppUser.findOne({
                where: { role: "SUPER_ADMIN" },
                transaction: t,
            });

            if (platformAdmin) {
                await creditWalletsOnSale({
                    orderId: order.orderId,
                    vendorId: order.vendorId,
                    doctorId: order.doctorId,
                    platformUserId: platformAdmin.id,
                    vendorAmount: splitTxn.vendorAmount,
                    doctorAmount: splitTxn.doctorAmount,
                    platformAmount: splitTxn.platformAmount,
                    transaction: t,
                });
            }
        }

        // Log webhook
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