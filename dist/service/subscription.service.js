"use strict";
// src/service/subscription.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.incrementPageUsage = exports.isManualEntryEnabled = exports.isScanEnabled = exports.canAddDiaryPage = exports.upgradePlan = exports.activateUpgradeAfterPayment = exports.initiateUpgradePayment = exports.getAllSubscriptions = exports.getPatientSubscription = exports.linkDoctor = exports.subscribeToPlan = exports.activateSubscriptionAfterPayment = exports.initiateSubscriptionPayment = exports.getPlanById = exports.getAllPlans = exports.deletePlan = exports.updatePlan = exports.createPlan = void 0;
const crypto_1 = __importDefault(require("crypto"));
const sequelize_1 = require("sequelize");
const Dbconnetion_1 = require("../config/Dbconnetion");
const SubscriptionPlan_1 = require("../models/SubscriptionPlan");
const UserSubscription_1 = require("../models/UserSubscription");
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const Diary_1 = require("../models/Diary");
const GeneratedDiary_1 = require("../models/GeneratedDiary");
const DoctorAssignmentRequest_1 = require("../models/DoctorAssignmentRequest");
const Order_1 = require("../models/Order");
const paymentGateway_service_1 = require("./paymentGateway.service");
const diaryStatus_1 = require("../utils/diaryStatus");
// ═══════════════════════════════════════════════════════════════════════════
// PLAN CRUD (Super Admin)
// ═══════════════════════════════════════════════════════════════════════════
const createPlan = async (data) => {
    // If marking as popular, unmark others
    if (data.isPopular) {
        await SubscriptionPlan_1.SubscriptionPlan.update({ isPopular: false }, { where: { isPopular: true } });
    }
    return await SubscriptionPlan_1.SubscriptionPlan.create(data);
};
exports.createPlan = createPlan;
const updatePlan = async (planId, data) => {
    const plan = await SubscriptionPlan_1.SubscriptionPlan.findByPk(planId);
    if (!plan)
        throw new Error("Plan not found");
    // If marking as popular, unmark others
    if (data.isPopular) {
        await SubscriptionPlan_1.SubscriptionPlan.update({ isPopular: false }, { where: { isPopular: true, id: { [sequelize_1.Op.ne]: planId } } });
    }
    await plan.update(data);
    return plan;
};
exports.updatePlan = updatePlan;
const deletePlan = async (planId) => {
    const plan = await SubscriptionPlan_1.SubscriptionPlan.findByPk(planId);
    if (!plan)
        throw new Error("Plan not found");
    // Check if any active subscriptions use this plan
    const activeCount = await UserSubscription_1.UserSubscription.count({
        where: { planId, status: "ACTIVE" },
    });
    if (activeCount > 0) {
        throw new Error(`Cannot delete plan with ${activeCount} active subscription(s). Deactivate the plan instead.`);
    }
    await plan.destroy(); // soft delete (paranoid)
    return { message: "Plan deleted successfully" };
};
exports.deletePlan = deletePlan;
const getAllPlans = async (includeInactive = false) => {
    const where = {};
    if (!includeInactive) {
        where.isActive = true;
    }
    return await SubscriptionPlan_1.SubscriptionPlan.findAll({
        where,
        order: [["sortOrder", "ASC"], ["createdAt", "ASC"]],
    });
};
exports.getAllPlans = getAllPlans;
const getPlanById = async (planId) => {
    const plan = await SubscriptionPlan_1.SubscriptionPlan.findByPk(planId);
    if (!plan)
        throw new Error("Plan not found");
    return plan;
};
exports.getPlanById = getPlanById;
// ═══════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION PAYMENT FLOW
// ═══════════════════════════════════════════════════════════════════════════
const generateOrderId = () => {
    const timestamp = Date.now().toString(36);
    const random = crypto_1.default.randomBytes(4).toString("hex");
    return `SUB-${timestamp}-${random}`.toUpperCase();
};
/**
 * Generate a new CanTRAC diary ID in the format CanTRAC-A###.
 * Finds the highest existing sequence number and increments by 1.
 */
const generateCanTracId = async () => {
    const lastDiary = await GeneratedDiary_1.GeneratedDiary.findOne({
        where: { id: { [sequelize_1.Op.like]: "CanTRAC-A%" } },
        order: [["createdAt", "DESC"]],
    });
    let sequence = 1;
    if (lastDiary) {
        const lastSeq = parseInt(lastDiary.id.replace("CanTRAC-A", ""), 10);
        if (!isNaN(lastSeq))
            sequence = lastSeq + 1;
    }
    return `CanTRAC-A${String(sequence).padStart(3, "0")}`;
};
/**
 * Step 1: Initiate subscription payment
 *
 * Creates a PENDING order with the active payment gateway.
 * Does NOT create the UserSubscription yet — that happens after payment.
 */
const initiateSubscriptionPayment = async (params) => {
    const { patientId, planId } = params;
    // 1. Validate patient
    const patient = await Patient_1.Patient.findByPk(patientId);
    if (!patient)
        throw new Error("Patient not found");
    // 1b. Patient must have an accepted doctor request before subscribing
    if (!patient.doctorId) {
        const acceptedRequest = await DoctorAssignmentRequest_1.DoctorAssignmentRequest.findOne({
            where: { patientId, status: "ACCEPTED" },
        });
        if (!acceptedRequest) {
            throw new Error("You must select a doctor and get approved before purchasing a subscription");
        }
    }
    // 2. Validate plan
    const plan = await SubscriptionPlan_1.SubscriptionPlan.findByPk(planId);
    if (!plan)
        throw new Error("Plan not found");
    if (!plan.isActive)
        throw new Error("This plan is no longer available");
    // 3. Check for existing active subscription
    const existingActive = await UserSubscription_1.UserSubscription.findOne({
        where: { patientId, status: "ACTIVE" },
    });
    if (existingActive) {
        throw new Error("Patient already has an active subscription. Upgrade or cancel the current plan first.");
    }
    // 4. Check for an existing PENDING order for this patient + plan
    const existingPending = await Order_1.Order.findOne({
        where: {
            patientId,
            subscriptionPlanId: planId,
            // status: "PENDING",
        },
    });
    if (existingPending) {
        // Return the existing pending order details so the user can retry payment
        const gateway = existingPending.paymentGateway || "CASHFREE";
        return {
            orderId: existingPending.orderId,
            gateway,
            gatewayOrderId: existingPending.cfOrderId || "",
            paymentSessionId: gateway === "CASHFREE" ? existingPending.paymentSessionId : undefined,
            razorpayKeyId: gateway === "RAZORPAY" ? process.env.RAZORPAY_KEY_ID : undefined,
            amount: Number(existingPending.amount),
            currency: existingPending.currency,
            plan: {
                id: plan.id,
                name: plan.name,
                monthlyPrice: plan.monthlyPrice,
            },
        };
    }
    // 5. Create payment order with active gateway
    const orderId = generateOrderId();
    const amount = Number(plan.monthlyPrice);
    const paymentResult = await (0, paymentGateway_service_1.createPaymentOrder)({
        orderId,
        amount,
        customerName: patient.fullName || "Patient",
        customerPhone: patient.phone || "9999999999",
        orderNote: `Subscription: ${plan.name}`,
        notes: {
            planId,
            patientId,
            planName: plan.name,
        },
    });
    // 6. Save Order as PENDING
    await Order_1.Order.create({
        orderId,
        cfOrderId: paymentResult.gatewayOrderId,
        patientId,
        doctorId: null,
        vendorId: null,
        amount,
        currency: "INR",
        status: "PENDING",
        paymentSessionId: paymentResult.paymentSessionId || null,
        paymentGateway: paymentResult.gateway,
        subscriptionPlanId: planId,
        orderNote: `Subscription: ${plan.name}`,
    });
    return {
        orderId,
        gateway: paymentResult.gateway,
        gatewayOrderId: paymentResult.gatewayOrderId,
        paymentSessionId: paymentResult.paymentSessionId,
        razorpayKeyId: paymentResult.razorpayKeyId,
        amount,
        currency: "INR",
        plan: {
            id: plan.id,
            name: plan.name,
            monthlyPrice: plan.monthlyPrice,
        },
    };
};
exports.initiateSubscriptionPayment = initiateSubscriptionPayment;
/**
 * Step 2: Activate subscription after successful payment
 *
 * Called from:
 * - Razorpay client-side verify endpoint
 * - Cashfree/Razorpay webhook handlers
 *
 * Idempotent: safe to call multiple times for the same order.
 */
const activateSubscriptionAfterPayment = async (orderId, paymentMethod, transactionId) => {
    return await Dbconnetion_1.sequelize.transaction(async (t) => {
        // 1. Find and lock the order
        const order = await Order_1.Order.findOne({
            where: { orderId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });
        if (!order)
            throw new Error(`Order ${orderId} not found`);
        // Idempotency: already processed
        if (order.status === "PAID") {
            const existingSub = await UserSubscription_1.UserSubscription.findOne({
                where: { paymentOrderId: orderId },
                transaction: t,
            });
            return { subscription: existingSub, alreadyProcessed: true };
        }
        if (!order.subscriptionPlanId) {
            throw new Error("Order is not a subscription order");
        }
        // 2. Get the plan
        const plan = await SubscriptionPlan_1.SubscriptionPlan.findByPk(order.subscriptionPlanId, { transaction: t });
        if (!plan)
            throw new Error("Subscription plan not found");
        // 3. Update order status
        order.status = "PAID";
        order.paymentMethod = paymentMethod || order.paymentMethod;
        order.transactionId = transactionId || order.transactionId;
        order.paidAt = new Date();
        await order.save({ transaction: t });
        // 4. Get the patient and their accepted doctor
        const patient = await Patient_1.Patient.findByPk(order.patientId, { transaction: t });
        if (!patient)
            throw new Error("Patient not found");
        const doctorId = patient.doctorId || null;
        // 5. Assign diary — only if the patient does NOT already have one.
        // Patients registered via physical diary sale already have a diaryId; overwriting
        // it would detach their sticker and allow it to be re-registered to another patient.
        let assignedDiaryId;
        if (patient.diaryId) {
            // Patient already has a physical diary — use it for this subscription.
            assignedDiaryId = patient.diaryId;
            console.info(`[DIARY_REUSE] scope=subscription_checkout patientId=${order.patientId} existingDiaryId=${assignedDiaryId}`);
        }
        else {
            // Self-signup patient with no diary yet — assign one from the pool.
            let generatedDiary = await GeneratedDiary_1.GeneratedDiary.findOne({
                where: { status: "unassigned" },
                order: [["createdAt", "ASC"]],
                lock: t.LOCK.UPDATE,
                transaction: t,
            });
            if (!generatedDiary) {
                const diaryId = await generateCanTracId();
                generatedDiary = await GeneratedDiary_1.GeneratedDiary.create({
                    id: diaryId,
                    diaryType: "peri-operative",
                    status: "unassigned",
                    generatedDate: new Date(),
                }, { transaction: t });
            }
            generatedDiary.status = "sold";
            generatedDiary.soldTo = order.patientId;
            generatedDiary.soldDate = new Date();
            await generatedDiary.save({ transaction: t });
            await Diary_1.Diary.create({
                id: generatedDiary.id,
                patientId: order.patientId,
                doctorId,
                status: diaryStatus_1.DIARY_STATUS.APPROVED,
                activationDate: new Date(),
                saleAmount: Number(plan.monthlyPrice),
                commissionAmount: 0,
            }, { transaction: t });
            console.info(`[DIARY_CREATE] scope=subscription_checkout patientId=${order.patientId} diaryId=${generatedDiary.id} status=${diaryStatus_1.DIARY_STATUS.APPROVED}`);
            patient.diaryId = generatedDiary.id;
            await patient.save({ transaction: t });
            assignedDiaryId = generatedDiary.id;
        }
        // 6. Create the subscription (with diary and doctor linked)
        const now = new Date();
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription
        const subscription = await UserSubscription_1.UserSubscription.create({
            patientId: order.patientId,
            planId: order.subscriptionPlanId,
            diaryId: assignedDiaryId,
            doctorId,
            status: "ACTIVE",
            paidAmount: plan.monthlyPrice,
            maxDiaryPages: plan.maxDiaryPages,
            scanEnabled: plan.scanEnabled,
            manualEntryEnabled: plan.manualEntryEnabled,
            pagesUsed: 0,
            paymentOrderId: orderId,
            paymentMethod: paymentMethod || order.paymentGateway,
            startDate: now,
            endDate,
        }, { transaction: t });
        return {
            subscription,
            diaryId: assignedDiaryId,
            plan: {
                name: plan.name,
                maxDiaryPages: plan.maxDiaryPages,
                scanEnabled: plan.scanEnabled,
                manualEntryEnabled: plan.manualEntryEnabled,
            },
            alreadyProcessed: false,
        };
    });
};
exports.activateSubscriptionAfterPayment = activateSubscriptionAfterPayment;
// ═══════════════════════════════════════════════════════════════════════════
// LEGACY: Direct subscribe (kept for backward compatibility / free plans)
// ═══════════════════════════════════════════════════════════════════════════
const subscribeToPlan = async (params) => {
    const { patientId, planId, paymentOrderId, paymentMethod } = params;
    return await Dbconnetion_1.sequelize.transaction(async (t) => {
        // 1. Validate patient
        const patient = await Patient_1.Patient.findByPk(patientId, { transaction: t });
        if (!patient)
            throw new Error("Patient not found");
        // 1b. Patient must have an accepted doctor before subscribing
        if (!patient.doctorId) {
            const acceptedRequest = await DoctorAssignmentRequest_1.DoctorAssignmentRequest.findOne({
                where: { patientId, status: "ACCEPTED" },
                transaction: t,
            });
            if (!acceptedRequest) {
                throw new Error("You must select a doctor and get approved before purchasing a subscription");
            }
        }
        // 2. Validate plan
        const plan = await SubscriptionPlan_1.SubscriptionPlan.findByPk(planId, { transaction: t });
        if (!plan)
            throw new Error("Plan not found");
        if (!plan.isActive)
            throw new Error("This plan is no longer available");
        // 3. Check for existing active subscription
        const existingActive = await UserSubscription_1.UserSubscription.findOne({
            where: { patientId, status: "ACTIVE" },
            transaction: t,
        });
        if (existingActive) {
            throw new Error("Patient already has an active subscription. Upgrade or cancel the current plan first.");
        }
        // 4. Assign diary — only if the patient does NOT already have one.
        const doctorId = patient.doctorId || null;
        let assignedDiaryId;
        if (patient.diaryId) {
            // Patient already has a physical diary — reuse it; do NOT overwrite.
            assignedDiaryId = patient.diaryId;
            console.info(`[DIARY_REUSE] scope=subscription_direct patientId=${patientId} existingDiaryId=${assignedDiaryId}`);
        }
        else {
            // Self-signup patient with no diary yet — assign one from the pool.
            let generatedDiary = await GeneratedDiary_1.GeneratedDiary.findOne({
                where: { status: "unassigned" },
                order: [["createdAt", "ASC"]],
                lock: t.LOCK.UPDATE,
                transaction: t,
            });
            if (!generatedDiary) {
                const diaryId = await generateCanTracId();
                generatedDiary = await GeneratedDiary_1.GeneratedDiary.create({
                    id: diaryId,
                    diaryType: "peri-operative",
                    status: "unassigned",
                    generatedDate: new Date(),
                }, { transaction: t });
            }
            generatedDiary.status = "sold";
            generatedDiary.soldTo = patientId;
            generatedDiary.soldDate = new Date();
            await generatedDiary.save({ transaction: t });
            await Diary_1.Diary.create({
                id: generatedDiary.id,
                patientId,
                doctorId,
                status: diaryStatus_1.DIARY_STATUS.APPROVED,
                activationDate: new Date(),
                saleAmount: Number(plan.monthlyPrice),
                commissionAmount: 0,
            }, { transaction: t });
            console.info(`[DIARY_CREATE] scope=subscription_direct patientId=${patientId} diaryId=${generatedDiary.id} status=${diaryStatus_1.DIARY_STATUS.APPROVED}`);
            patient.diaryId = generatedDiary.id;
            await patient.save({ transaction: t });
            assignedDiaryId = generatedDiary.id;
        }
        // 5. Create subscription with diary and doctor linked
        const now = new Date();
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription
        const subscription = await UserSubscription_1.UserSubscription.create({
            patientId,
            planId,
            diaryId: assignedDiaryId,
            doctorId,
            status: "ACTIVE",
            paidAmount: plan.monthlyPrice,
            maxDiaryPages: plan.maxDiaryPages,
            scanEnabled: plan.scanEnabled,
            manualEntryEnabled: plan.manualEntryEnabled,
            pagesUsed: 0,
            paymentOrderId,
            paymentMethod,
            startDate: now,
            endDate,
        }, { transaction: t });
        return {
            subscription,
            diaryId: assignedDiaryId,
            plan: {
                name: plan.name,
                maxDiaryPages: plan.maxDiaryPages,
                scanEnabled: plan.scanEnabled,
                manualEntryEnabled: plan.manualEntryEnabled,
            },
        };
    });
};
exports.subscribeToPlan = subscribeToPlan;
// ═══════════════════════════════════════════════════════════════════════════
// DOCTOR LINKING
// ═══════════════════════════════════════════════════════════════════════════
const linkDoctor = async (subscriptionId, doctorId) => {
    return await Dbconnetion_1.sequelize.transaction(async (t) => {
        const subscription = await UserSubscription_1.UserSubscription.findByPk(subscriptionId, { transaction: t });
        if (!subscription)
            throw new Error("Subscription not found");
        if (subscription.status !== "ACTIVE")
            throw new Error("Subscription is not active");
        const doctor = await Appuser_1.AppUser.findOne({
            where: { id: doctorId, role: "DOCTOR", isActive: true },
            transaction: t,
        });
        if (!doctor)
            throw new Error("Doctor not found or inactive");
        // Update subscription
        subscription.doctorId = doctorId;
        await subscription.save({ transaction: t });
        // Update patient doctor link
        const patient = await Patient_1.Patient.findByPk(subscription.patientId, { transaction: t });
        if (patient) {
            patient.doctorId = doctorId;
            await patient.save({ transaction: t });
        }
        // Update diary doctor link
        if (subscription.diaryId) {
            const diary = await Diary_1.Diary.findByPk(subscription.diaryId, { transaction: t });
            if (diary) {
                diary.doctorId = doctorId;
                await diary.save({ transaction: t });
            }
        }
        return subscription;
    });
};
exports.linkDoctor = linkDoctor;
// ═══════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION QUERIES
// ═══════════════════════════════════════════════════════════════════════════
const getPatientSubscription = async (patientId) => {
    return await UserSubscription_1.UserSubscription.findOne({
        where: { patientId, status: "ACTIVE" },
        include: [
            { model: SubscriptionPlan_1.SubscriptionPlan, attributes: ["id", "name", "description", "monthlyPrice", "isPopular"] },
            { model: Patient_1.Patient, attributes: ["id", "fullName", "phone", "diaryId"] },
            { model: Appuser_1.AppUser, attributes: ["id", "fullName", "email", "specialization"] },
        ],
    });
};
exports.getPatientSubscription = getPatientSubscription;
const getAllSubscriptions = async (params) => {
    const { page, limit, status } = params;
    const where = {};
    if (status)
        where.status = status;
    const { rows, count } = await UserSubscription_1.UserSubscription.findAndCountAll({
        where,
        include: [
            { model: SubscriptionPlan_1.SubscriptionPlan, attributes: ["id", "name", "monthlyPrice"] },
            { model: Patient_1.Patient, attributes: ["id", "fullName", "phone", "diaryId", "status"] },
            { model: Appuser_1.AppUser, attributes: ["id", "fullName", "email"] },
        ],
        order: [["createdAt", "DESC"]],
        limit,
        offset: (page - 1) * limit,
    });
    return {
        subscriptions: rows,
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
    };
};
exports.getAllSubscriptions = getAllSubscriptions;
// ═══════════════════════════════════════════════════════════════════════════
// UPGRADE SUBSCRIPTION PAYMENT FLOW
// ═══════════════════════════════════════════════════════════════════════════
const generateUpgradeOrderId = () => {
    const timestamp = Date.now().toString(36);
    const random = crypto_1.default.randomBytes(4).toString("hex");
    return `UPG-${timestamp}-${random}`.toUpperCase();
};
/**
 * Step 1: Initiate an upgrade payment order.
 * Patient must have an ACTIVE subscription. Creates a PENDING order for the new plan price.
 */
const initiateUpgradePayment = async (params) => {
    const { patientId, newPlanId } = params;
    // 1. Validate patient & active subscription
    const patient = await Patient_1.Patient.findByPk(patientId);
    if (!patient)
        throw new Error("Patient not found");
    const currentSub = await UserSubscription_1.UserSubscription.findOne({
        where: { patientId, status: "ACTIVE" },
        include: [{ model: SubscriptionPlan_1.SubscriptionPlan, attributes: ["id", "name"] }],
    });
    if (!currentSub)
        throw new Error("No active subscription found. Please subscribe first.");
    // 2. Validate new plan
    const newPlan = await SubscriptionPlan_1.SubscriptionPlan.findByPk(newPlanId);
    if (!newPlan)
        throw new Error("Plan not found");
    if (!newPlan.isActive)
        throw new Error("This plan is no longer available");
    if (newPlanId === currentSub.planId)
        throw new Error("You are already on this plan");
    // 3. Idempotency: return existing PENDING upgrade order if present
    const existingPending = await Order_1.Order.findOne({
        where: { patientId, subscriptionPlanId: newPlanId, status: "PENDING" },
    });
    if (existingPending) {
        const gateway = existingPending.paymentGateway || "CASHFREE";
        return {
            orderId: existingPending.orderId,
            gateway,
            gatewayOrderId: existingPending.cfOrderId || "",
            paymentSessionId: gateway === "CASHFREE" ? existingPending.paymentSessionId : undefined,
            razorpayKeyId: gateway === "RAZORPAY" ? process.env.RAZORPAY_KEY_ID : undefined,
            amount: Number(existingPending.amount),
            currency: existingPending.currency,
            plan: { id: newPlan.id, name: newPlan.name, monthlyPrice: newPlan.monthlyPrice },
        };
    }
    // 4. Create payment order with active gateway
    const orderId = generateUpgradeOrderId();
    const amount = Number(newPlan.monthlyPrice);
    const paymentResult = await (0, paymentGateway_service_1.createPaymentOrder)({
        orderId,
        amount,
        customerName: patient.fullName || "Patient",
        customerPhone: patient.phone || "9999999999",
        orderNote: `Upgrade: ${newPlan.name}`,
        notes: { newPlanId, patientId, planName: newPlan.name, isUpgrade: "true" },
    });
    // 5. Save Order as PENDING (orderNote prefix "Upgrade:" is used by webhooks to route correctly)
    await Order_1.Order.create({
        orderId,
        cfOrderId: paymentResult.gatewayOrderId,
        patientId,
        doctorId: null,
        vendorId: null,
        amount,
        currency: "INR",
        status: "PENDING",
        paymentSessionId: paymentResult.paymentSessionId || null,
        paymentGateway: paymentResult.gateway,
        subscriptionPlanId: newPlanId,
        orderNote: `Upgrade: ${newPlan.name}`,
    });
    return {
        orderId,
        gateway: paymentResult.gateway,
        gatewayOrderId: paymentResult.gatewayOrderId,
        paymentSessionId: paymentResult.paymentSessionId,
        razorpayKeyId: paymentResult.razorpayKeyId,
        amount,
        currency: "INR",
        plan: { id: newPlan.id, name: newPlan.name, monthlyPrice: newPlan.monthlyPrice },
    };
};
exports.initiateUpgradePayment = initiateUpgradePayment;
/**
 * Step 2: Activate the upgrade after successful payment.
 * Marks the current subscription as UPGRADED and creates a new ACTIVE one with the same diary/doctor.
 * Idempotent — safe to call multiple times for the same order.
 */
const activateUpgradeAfterPayment = async (orderId, paymentMethod, transactionId) => {
    return await Dbconnetion_1.sequelize.transaction(async (t) => {
        // 1. Find and lock the order
        const order = await Order_1.Order.findOne({
            where: { orderId },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });
        if (!order)
            throw new Error(`Order ${orderId} not found`);
        // Idempotency: already processed
        if (order.status === "PAID") {
            const existingSub = await UserSubscription_1.UserSubscription.findOne({
                where: { paymentOrderId: orderId },
                transaction: t,
            });
            return { subscription: existingSub, alreadyProcessed: true };
        }
        if (!order.subscriptionPlanId)
            throw new Error("Order is not an upgrade order");
        // 2. Update order to PAID
        order.status = "PAID";
        order.paymentMethod = paymentMethod || order.paymentMethod;
        order.transactionId = transactionId || order.transactionId;
        order.paidAt = new Date();
        await order.save({ transaction: t });
        // 3. Get new plan
        const newPlan = await SubscriptionPlan_1.SubscriptionPlan.findByPk(order.subscriptionPlanId, { transaction: t });
        if (!newPlan)
            throw new Error("Subscription plan not found");
        // 4. Find and lock the current ACTIVE subscription
        const current = await UserSubscription_1.UserSubscription.findOne({
            where: { patientId: order.patientId, status: "ACTIVE" },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });
        if (!current)
            throw new Error("No active subscription found to upgrade");
        // 5. Mark current subscription as UPGRADED
        current.status = "UPGRADED";
        await current.save({ transaction: t });
        // 6. Create new subscription carrying over diary + doctor + page usage
        const now = new Date();
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + 1);
        const newSub = await UserSubscription_1.UserSubscription.create({
            patientId: order.patientId,
            planId: order.subscriptionPlanId,
            diaryId: current.diaryId,
            doctorId: current.doctorId,
            status: "ACTIVE",
            paidAmount: newPlan.monthlyPrice,
            maxDiaryPages: newPlan.maxDiaryPages,
            scanEnabled: newPlan.scanEnabled,
            manualEntryEnabled: newPlan.manualEntryEnabled,
            pagesUsed: current.pagesUsed,
            paymentOrderId: orderId,
            paymentMethod: paymentMethod || order.paymentGateway,
            startDate: now,
            endDate,
        }, { transaction: t });
        console.info(`[UPGRADE] patientId=${order.patientId} from plan=${current.planId} to plan=${newPlan.id} orderId=${orderId}`);
        return {
            subscription: newSub,
            plan: {
                name: newPlan.name,
                maxDiaryPages: newPlan.maxDiaryPages,
                scanEnabled: newPlan.scanEnabled,
                manualEntryEnabled: newPlan.manualEntryEnabled,
            },
            alreadyProcessed: false,
        };
    });
};
exports.activateUpgradeAfterPayment = activateUpgradeAfterPayment;
// ═══════════════════════════════════════════════════════════════════════════
// PLAN UPGRADE / DOWNGRADE (legacy direct upgrade — no payment)
// ═══════════════════════════════════════════════════════════════════════════
const upgradePlan = async (params) => {
    const { patientId, newPlanId, paymentOrderId, paymentMethod } = params;
    return await Dbconnetion_1.sequelize.transaction(async (t) => {
        // 1. Find current active subscription
        const current = await UserSubscription_1.UserSubscription.findOne({
            where: { patientId, status: "ACTIVE" },
            transaction: t,
            lock: t.LOCK.UPDATE,
        });
        if (!current)
            throw new Error("No active subscription found");
        // 2. Validate new plan
        const newPlan = await SubscriptionPlan_1.SubscriptionPlan.findByPk(newPlanId, { transaction: t });
        if (!newPlan)
            throw new Error("New plan not found");
        if (!newPlan.isActive)
            throw new Error("New plan is not available");
        if (newPlanId === current.planId)
            throw new Error("Already on this plan");
        // 3. Mark current as UPGRADED
        current.status = "UPGRADED";
        await current.save({ transaction: t });
        // 4. Create new subscription preserving diary & doctor
        const now = new Date();
        const endDate = new Date(now);
        endDate.setMonth(endDate.getMonth() + 1);
        const newSub = await UserSubscription_1.UserSubscription.create({
            patientId,
            planId: newPlanId,
            diaryId: current.diaryId,
            doctorId: current.doctorId,
            status: "ACTIVE",
            paidAmount: newPlan.monthlyPrice,
            maxDiaryPages: newPlan.maxDiaryPages,
            scanEnabled: newPlan.scanEnabled,
            manualEntryEnabled: newPlan.manualEntryEnabled,
            pagesUsed: current.pagesUsed,
            paymentOrderId,
            paymentMethod,
            startDate: now,
            endDate,
        }, { transaction: t });
        return {
            previousPlan: current.planId,
            newSubscription: newSub,
            plan: {
                name: newPlan.name,
                maxDiaryPages: newPlan.maxDiaryPages,
                scanEnabled: newPlan.scanEnabled,
                manualEntryEnabled: newPlan.manualEntryEnabled,
            },
        };
    });
};
exports.upgradePlan = upgradePlan;
// ═══════════════════════════════════════════════════════════════════════════
// PERMISSION CHECKS
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Check if a patient can add a diary page (page limit enforcement)
 */
const canAddDiaryPage = async (patientId) => {
    const subscription = await UserSubscription_1.UserSubscription.findOne({
        where: { patientId, status: "ACTIVE" },
    });
    if (!subscription) {
        return { allowed: false, reason: "No active subscription", pagesUsed: 0, maxPages: 0 };
    }
    // Check expiry
    if (new Date() > subscription.endDate) {
        subscription.status = "EXPIRED";
        await subscription.save();
        return { allowed: false, reason: "Subscription expired", pagesUsed: subscription.pagesUsed, maxPages: subscription.maxDiaryPages };
    }
    // -1 means unlimited
    if (subscription.maxDiaryPages === -1) {
        return { allowed: true, pagesUsed: subscription.pagesUsed, maxPages: -1 };
    }
    if (subscription.pagesUsed >= subscription.maxDiaryPages) {
        return {
            allowed: false,
            reason: `Page limit reached (${subscription.pagesUsed}/${subscription.maxDiaryPages}). Upgrade your plan for more pages.`,
            pagesUsed: subscription.pagesUsed,
            maxPages: subscription.maxDiaryPages,
        };
    }
    return { allowed: true, pagesUsed: subscription.pagesUsed, maxPages: subscription.maxDiaryPages };
};
exports.canAddDiaryPage = canAddDiaryPage;
/**
 * Check if scan feature is enabled for patient
 */
const isScanEnabled = async (patientId) => {
    const subscription = await UserSubscription_1.UserSubscription.findOne({
        where: { patientId, status: "ACTIVE" },
    });
    if (!subscription)
        return false;
    if (new Date() > subscription.endDate)
        return false;
    return subscription.scanEnabled;
};
exports.isScanEnabled = isScanEnabled;
/**
 * Check if manual entry is enabled for patient
 */
const isManualEntryEnabled = async (patientId) => {
    const subscription = await UserSubscription_1.UserSubscription.findOne({
        where: { patientId, status: "ACTIVE" },
    });
    if (!subscription)
        return false;
    if (new Date() > subscription.endDate)
        return false;
    return subscription.manualEntryEnabled;
};
exports.isManualEntryEnabled = isManualEntryEnabled;
/**
 * Increment page usage after a successful diary page submission
 */
const incrementPageUsage = async (patientId) => {
    const subscription = await UserSubscription_1.UserSubscription.findOne({
        where: { patientId, status: "ACTIVE" },
    });
    if (!subscription)
        throw new Error("No active subscription");
    subscription.pagesUsed += 1;
    await subscription.save();
    return subscription.pagesUsed;
};
exports.incrementPageUsage = incrementPageUsage;
