// src/service/subscription.service.ts

import crypto from "crypto";
import { Op } from "sequelize";
import { sequelize } from "../config/Dbconnetion";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { UserSubscription } from "../models/UserSubscription";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { Diary } from "../models/Diary";
import { GeneratedDiary } from "../models/GeneratedDiary";
import { DoctorAssignmentRequest } from "../models/DoctorAssignmentRequest";
import { Order } from "../models/Order";
import { createPaymentOrder, getActiveGateway } from "./paymentGateway.service";
import { DIARY_STATUS } from "../utils/diaryStatus";

// ═══════════════════════════════════════════════════════════════════════════
// PLAN CRUD (Super Admin)
// ═══════════════════════════════════════════════════════════════════════════

export const createPlan = async (data: {
  name: string;
  description?: string;
  monthlyPrice: number;
  maxDiaryPages: number;
  scanEnabled: boolean;
  manualEntryEnabled: boolean;
  isPopular: boolean;
  isActive?: boolean;
  sortOrder?: number;
}) => {
  // If marking as popular, unmark others
  if (data.isPopular) {
    await SubscriptionPlan.update({ isPopular: false }, { where: { isPopular: true } });
  }

  return await SubscriptionPlan.create(data);
};

export const updatePlan = async (planId: string, data: Partial<{
  name: string;
  description: string;
  monthlyPrice: number;
  maxDiaryPages: number;
  scanEnabled: boolean;
  manualEntryEnabled: boolean;
  isPopular: boolean;
  isActive: boolean;
  sortOrder: number;
}>) => {
  const plan = await SubscriptionPlan.findByPk(planId);
  if (!plan) throw new Error("Plan not found");

  // If marking as popular, unmark others
  if (data.isPopular) {
    await SubscriptionPlan.update(
      { isPopular: false },
      { where: { isPopular: true, id: { [Op.ne]: planId } } }
    );
  }

  await plan.update(data);
  return plan;
};

export const deletePlan = async (planId: string) => {
  const plan = await SubscriptionPlan.findByPk(planId);
  if (!plan) throw new Error("Plan not found");

  // Check if any active subscriptions use this plan
  const activeCount = await UserSubscription.count({
    where: { planId, status: "ACTIVE" },
  });
  if (activeCount > 0) {
    throw new Error(`Cannot delete plan with ${activeCount} active subscription(s). Deactivate the plan instead.`);
  }

  await plan.destroy(); // soft delete (paranoid)
  return { message: "Plan deleted successfully" };
};

export const getAllPlans = async (includeInactive = false) => {
  const where: any = {};
  if (!includeInactive) {
    where.isActive = true;
  }
  return await SubscriptionPlan.findAll({
    where,
    order: [["sortOrder", "ASC"], ["createdAt", "ASC"]],
  });
};

export const getPlanById = async (planId: string) => {
  const plan = await SubscriptionPlan.findByPk(planId);
  if (!plan) throw new Error("Plan not found");
  return plan;
};

// ═══════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION PAYMENT FLOW
// ═══════════════════════════════════════════════════════════════════════════

const generateOrderId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString("hex");
  return `SUB-${timestamp}-${random}`.toUpperCase();
};

/**
 * Generate a new CanTRAC diary ID in the format CanTRAC-A###.
 * Finds the highest existing sequence number and increments by 1.
 */
const generateCanTracId = async (): Promise<string> => {
  const lastDiary = await GeneratedDiary.findOne({
    where: { id: { [Op.like]: "CanTRAC-A%" } },
    order: [["createdAt", "DESC"]],
  });

  let sequence = 1;
  if (lastDiary) {
    const lastSeq = parseInt(lastDiary.id.replace("CanTRAC-A", ""), 10);
    if (!isNaN(lastSeq)) sequence = lastSeq + 1;
  }

  return `CanTRAC-A${String(sequence).padStart(3, "0")}`;
};

/**
 * Step 1: Initiate subscription payment
 *
 * Creates a PENDING order with the active payment gateway.
 * Does NOT create the UserSubscription yet — that happens after payment.
 */
export const initiateSubscriptionPayment = async (params: {
  patientId: string;
  planId: string;
}) => {
  const { patientId, planId } = params;

  // 1. Validate patient
  const patient = await Patient.findByPk(patientId);
  if (!patient) throw new Error("Patient not found");

  // 1b. Patient must have an accepted doctor request before subscribing
  if (!patient.doctorId) {
    const acceptedRequest = await DoctorAssignmentRequest.findOne({
      where: { patientId, status: "ACCEPTED" },
    });
    if (!acceptedRequest) {
      throw new Error("You must select a doctor and get approved before purchasing a subscription");
    }
  }

  // 2. Validate plan
  const plan = await SubscriptionPlan.findByPk(planId);
  if (!plan) throw new Error("Plan not found");
  if (!plan.isActive) throw new Error("This plan is no longer available");

  // 3. Check for existing active subscription
  const existingActive = await UserSubscription.findOne({
    where: { patientId, status: "ACTIVE" },
  });
  if (existingActive) {
    throw new Error("Patient already has an active subscription. Upgrade or cancel the current plan first.");
  }

  // 4. Check for an existing PENDING order for this patient + plan
  const existingPending = await Order.findOne({
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

  const paymentResult = await createPaymentOrder({
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
  await Order.create({
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

/**
 * Step 2: Activate subscription after successful payment
 *
 * Called from:
 * - Razorpay client-side verify endpoint
 * - Cashfree/Razorpay webhook handlers
 *
 * Idempotent: safe to call multiple times for the same order.
 */
export const activateSubscriptionAfterPayment = async (
  orderId: string,
  paymentMethod?: string,
  transactionId?: string
) => {
  return await sequelize.transaction(async (t) => {
    // 1. Find and lock the order
    const order = await Order.findOne({
      where: { orderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!order) throw new Error(`Order ${orderId} not found`);

    // Idempotency: already processed
    if (order.status === "PAID") {
      const existingSub = await UserSubscription.findOne({
        where: { paymentOrderId: orderId },
        transaction: t,
      });
      return { subscription: existingSub, alreadyProcessed: true };
    }

    if (!order.subscriptionPlanId) {
      throw new Error("Order is not a subscription order");
    }

    // 2. Get the plan
    const plan = await SubscriptionPlan.findByPk(order.subscriptionPlanId, { transaction: t });
    if (!plan) throw new Error("Subscription plan not found");

    // 3. Update order status
    order.status = "PAID";
    order.paymentMethod = paymentMethod || order.paymentMethod;
    order.transactionId = transactionId || order.transactionId;
    order.paidAt = new Date();
    await order.save({ transaction: t });

    // 4. Get the patient and their accepted doctor
    const patient = await Patient.findByPk(order.patientId, { transaction: t });
    if (!patient) throw new Error("Patient not found");

    const doctorId = patient.doctorId || null;

    // 5. Assign diary from GeneratedDiary pool
    let generatedDiary = await GeneratedDiary.findOne({
      where: { status: "unassigned" },
      order: [["createdAt", "ASC"]],
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!generatedDiary) {
      const diaryId = await generateCanTracId();
      generatedDiary = await GeneratedDiary.create(
        {
          id: diaryId,
          diaryType: "peri-operative",
          status: "unassigned",
          generatedDate: new Date(),
        },
        { transaction: t }
      );
    }

    // Mark generated diary as sold
    generatedDiary.status = "sold";
    generatedDiary.soldTo = order.patientId;
    generatedDiary.soldDate = new Date();
    await generatedDiary.save({ transaction: t });

    // Create diary record
    await Diary.create(
      {
        id: generatedDiary.id,
        patientId: order.patientId,
        doctorId,
        status: DIARY_STATUS.APPROVED,
        activationDate: new Date(),
        saleAmount: Number(plan.monthlyPrice),
        commissionAmount: 0,
      },
      { transaction: t }
    );
    console.info(`[DIARY_CREATE] scope=subscription_checkout patientId=${order.patientId} diaryId=${generatedDiary.id} status=${DIARY_STATUS.APPROVED}`);

    // Update patient with diaryId
    patient.diaryId = generatedDiary.id;
    await patient.save({ transaction: t });

    // 6. Create the subscription (with diary and doctor linked)
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

    const subscription = await UserSubscription.create(
      {
        patientId: order.patientId,
        planId: order.subscriptionPlanId,
        diaryId: generatedDiary.id,
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
      },
      { transaction: t }
    );

    return {
      subscription,
      diaryId: generatedDiary.id,
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

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY: Direct subscribe (kept for backward compatibility / free plans)
// ═══════════════════════════════════════════════════════════════════════════

export const subscribeToPlan = async (params: {
  patientId: string;
  planId: string;
  paymentOrderId?: string;
  paymentMethod?: string;
}) => {
  const { patientId, planId, paymentOrderId, paymentMethod } = params;

  return await sequelize.transaction(async (t) => {
    // 1. Validate patient
    const patient = await Patient.findByPk(patientId, { transaction: t });
    if (!patient) throw new Error("Patient not found");

    // 1b. Patient must have an accepted doctor before subscribing
    if (!patient.doctorId) {
      const acceptedRequest = await DoctorAssignmentRequest.findOne({
        where: { patientId, status: "ACCEPTED" },
        transaction: t,
      });
      if (!acceptedRequest) {
        throw new Error("You must select a doctor and get approved before purchasing a subscription");
      }
    }

    // 2. Validate plan
    const plan = await SubscriptionPlan.findByPk(planId, { transaction: t });
    if (!plan) throw new Error("Plan not found");
    if (!plan.isActive) throw new Error("This plan is no longer available");

    // 3. Check for existing active subscription
    const existingActive = await UserSubscription.findOne({
      where: { patientId, status: "ACTIVE" },
      transaction: t,
    });
    if (existingActive) {
      throw new Error("Patient already has an active subscription. Upgrade or cancel the current plan first.");
    }

    // 4. Assign diary from GeneratedDiary pool
    const doctorId = patient.doctorId || null;

    let generatedDiary = await GeneratedDiary.findOne({
      where: { status: "unassigned" },
      order: [["createdAt", "ASC"]],
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!generatedDiary) {
      const diaryId = await generateCanTracId();
      generatedDiary = await GeneratedDiary.create(
        {
          id: diaryId,
          diaryType: "peri-operative",
          status: "unassigned",
          generatedDate: new Date(),
        },
        { transaction: t }
      );
    }

    generatedDiary.status = "sold";
    generatedDiary.soldTo = patientId;
    generatedDiary.soldDate = new Date();
    await generatedDiary.save({ transaction: t });

    await Diary.create(
      {
        id: generatedDiary.id,
        patientId,
        doctorId,
        status: DIARY_STATUS.APPROVED,
        activationDate: new Date(),
        saleAmount: Number(plan.monthlyPrice),
        commissionAmount: 0,
      },
      { transaction: t }
    );
    console.info(`[DIARY_CREATE] scope=subscription_direct patientId=${patientId} diaryId=${generatedDiary.id} status=${DIARY_STATUS.APPROVED}`);

    patient.diaryId = generatedDiary.id;
    await patient.save({ transaction: t });

    // 5. Create subscription with diary and doctor linked
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

    const subscription = await UserSubscription.create(
      {
        patientId,
        planId,
        diaryId: generatedDiary.id,
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
      },
      { transaction: t }
    );

    return {
      subscription,
      diaryId: generatedDiary.id,
      plan: {
        name: plan.name,
        maxDiaryPages: plan.maxDiaryPages,
        scanEnabled: plan.scanEnabled,
        manualEntryEnabled: plan.manualEntryEnabled,
      },
    };
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// DOCTOR LINKING
// ═══════════════════════════════════════════════════════════════════════════

export const linkDoctor = async (subscriptionId: string, doctorId: string) => {
  return await sequelize.transaction(async (t) => {
    const subscription = await UserSubscription.findByPk(subscriptionId, { transaction: t });
    if (!subscription) throw new Error("Subscription not found");
    if (subscription.status !== "ACTIVE") throw new Error("Subscription is not active");

    const doctor = await AppUser.findOne({
      where: { id: doctorId, role: "DOCTOR", isActive: true },
      transaction: t,
    });
    if (!doctor) throw new Error("Doctor not found or inactive");

    // Update subscription
    subscription.doctorId = doctorId;
    await subscription.save({ transaction: t });

    // Update patient doctor link
    const patient = await Patient.findByPk(subscription.patientId, { transaction: t });
    if (patient) {
      patient.doctorId = doctorId;
      await patient.save({ transaction: t });
    }

    // Update diary doctor link
    if (subscription.diaryId) {
      const diary = await Diary.findByPk(subscription.diaryId, { transaction: t });
      if (diary) {
        diary.doctorId = doctorId;
        await diary.save({ transaction: t });
      }
    }

    return subscription;
  });
};

// ═══════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION QUERIES
// ═══════════════════════════════════════════════════════════════════════════

export const getPatientSubscription = async (patientId: string) => {
  return await UserSubscription.findOne({
    where: { patientId, status: "ACTIVE" },
    include: [
      { model: SubscriptionPlan, attributes: ["id", "name", "description", "monthlyPrice", "isPopular"] },
      { model: Patient, attributes: ["id", "fullName", "phone", "diaryId"] },
      { model: AppUser, attributes: ["id", "fullName", "email", "specialization"] },
    ],
  });
};

export const getAllSubscriptions = async (params: {
  page: number;
  limit: number;
  status?: string;
}) => {
  const { page, limit, status } = params;
  const where: any = {};
  if (status) where.status = status;

  const { rows, count } = await UserSubscription.findAndCountAll({
    where,
    include: [
      { model: SubscriptionPlan, attributes: ["id", "name", "monthlyPrice"] },
      { model: Patient, attributes: ["id", "fullName", "phone", "diaryId", "status"] },
      { model: AppUser, attributes: ["id", "fullName", "email"] },
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

// ═══════════════════════════════════════════════════════════════════════════
// UPGRADE SUBSCRIPTION PAYMENT FLOW
// ═══════════════════════════════════════════════════════════════════════════

const generateUpgradeOrderId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString("hex");
  return `UPG-${timestamp}-${random}`.toUpperCase();
};

/**
 * Step 1: Initiate an upgrade payment order.
 * Patient must have an ACTIVE subscription. Creates a PENDING order for the new plan price.
 */
export const initiateUpgradePayment = async (params: {
  patientId: string;
  newPlanId: string;
}) => {
  const { patientId, newPlanId } = params;

  // 1. Validate patient & active subscription
  const patient = await Patient.findByPk(patientId);
  if (!patient) throw new Error("Patient not found");

  const currentSub = await UserSubscription.findOne({
    where: { patientId, status: "ACTIVE" },
    include: [{ model: SubscriptionPlan, attributes: ["id", "name"] }],
  });
  if (!currentSub) throw new Error("No active subscription found. Please subscribe first.");

  // 2. Validate new plan
  const newPlan = await SubscriptionPlan.findByPk(newPlanId);
  if (!newPlan) throw new Error("Plan not found");
  if (!newPlan.isActive) throw new Error("This plan is no longer available");
  if (newPlanId === currentSub.planId) throw new Error("You are already on this plan");

  // 3. Idempotency: return existing PENDING upgrade order if present
  const existingPending = await Order.findOne({
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

  const paymentResult = await createPaymentOrder({
    orderId,
    amount,
    customerName: patient.fullName || "Patient",
    customerPhone: patient.phone || "9999999999",
    orderNote: `Upgrade: ${newPlan.name}`,
    notes: { newPlanId, patientId, planName: newPlan.name, isUpgrade: "true" },
  });

  // 5. Save Order as PENDING (orderNote prefix "Upgrade:" is used by webhooks to route correctly)
  await Order.create({
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

/**
 * Step 2: Activate the upgrade after successful payment.
 * Marks the current subscription as UPGRADED and creates a new ACTIVE one with the same diary/doctor.
 * Idempotent — safe to call multiple times for the same order.
 */
export const activateUpgradeAfterPayment = async (
  orderId: string,
  paymentMethod?: string,
  transactionId?: string
) => {
  return await sequelize.transaction(async (t) => {
    // 1. Find and lock the order
    const order = await Order.findOne({
      where: { orderId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!order) throw new Error(`Order ${orderId} not found`);

    // Idempotency: already processed
    if (order.status === "PAID") {
      const existingSub = await UserSubscription.findOne({
        where: { paymentOrderId: orderId },
        transaction: t,
      });
      return { subscription: existingSub, alreadyProcessed: true };
    }

    if (!order.subscriptionPlanId) throw new Error("Order is not an upgrade order");

    // 2. Update order to PAID
    order.status = "PAID";
    order.paymentMethod = paymentMethod || order.paymentMethod;
    order.transactionId = transactionId || order.transactionId;
    order.paidAt = new Date();
    await order.save({ transaction: t });

    // 3. Get new plan
    const newPlan = await SubscriptionPlan.findByPk(order.subscriptionPlanId, { transaction: t });
    if (!newPlan) throw new Error("Subscription plan not found");

    // 4. Find and lock the current ACTIVE subscription
    const current = await UserSubscription.findOne({
      where: { patientId: order.patientId, status: "ACTIVE" },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!current) throw new Error("No active subscription found to upgrade");

    // 5. Mark current subscription as UPGRADED
    current.status = "UPGRADED";
    await current.save({ transaction: t });

    // 6. Create new subscription carrying over diary + doctor + page usage
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    const newSub = await UserSubscription.create(
      {
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
      },
      { transaction: t }
    );

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

// ═══════════════════════════════════════════════════════════════════════════
// PLAN UPGRADE / DOWNGRADE (legacy direct upgrade — no payment)
// ═══════════════════════════════════════════════════════════════════════════

export const upgradePlan = async (params: {
  patientId: string;
  newPlanId: string;
  paymentOrderId?: string;
  paymentMethod?: string;
}) => {
  const { patientId, newPlanId, paymentOrderId, paymentMethod } = params;

  return await sequelize.transaction(async (t) => {
    // 1. Find current active subscription
    const current = await UserSubscription.findOne({
      where: { patientId, status: "ACTIVE" },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!current) throw new Error("No active subscription found");

    // 2. Validate new plan
    const newPlan = await SubscriptionPlan.findByPk(newPlanId, { transaction: t });
    if (!newPlan) throw new Error("New plan not found");
    if (!newPlan.isActive) throw new Error("New plan is not available");
    if (newPlanId === current.planId) throw new Error("Already on this plan");

    // 3. Mark current as UPGRADED
    current.status = "UPGRADED";
    await current.save({ transaction: t });

    // 4. Create new subscription preserving diary & doctor
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1);

    const newSub = await UserSubscription.create(
      {
        patientId,
        planId: newPlanId,
        diaryId: current.diaryId,
        doctorId: current.doctorId,
        status: "ACTIVE",
        paidAmount: newPlan.monthlyPrice,
        maxDiaryPages: newPlan.maxDiaryPages,
        scanEnabled: newPlan.scanEnabled,
        manualEntryEnabled: newPlan.manualEntryEnabled,
        pagesUsed: current.pagesUsed, // carry forward usage
        paymentOrderId,
        paymentMethod,
        startDate: now,
        endDate,
      },
      { transaction: t }
    );

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

// ═══════════════════════════════════════════════════════════════════════════
// PERMISSION CHECKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a patient can add a diary page (page limit enforcement)
 */
export const canAddDiaryPage = async (patientId: string): Promise<{
  allowed: boolean;
  reason?: string;
  pagesUsed: number;
  maxPages: number;
}> => {
  const subscription = await UserSubscription.findOne({
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

/**
 * Check if scan feature is enabled for patient
 */
export const isScanEnabled = async (patientId: string): Promise<boolean> => {
  const subscription = await UserSubscription.findOne({
    where: { patientId, status: "ACTIVE" },
  });
  if (!subscription) return false;
  if (new Date() > subscription.endDate) return false;
  return subscription.scanEnabled;
};

/**
 * Check if manual entry is enabled for patient
 */
export const isManualEntryEnabled = async (patientId: string): Promise<boolean> => {
  const subscription = await UserSubscription.findOne({
    where: { patientId, status: "ACTIVE" },
  });
  if (!subscription) return false;
  if (new Date() > subscription.endDate) return false;
  return subscription.manualEntryEnabled;
};

/**
 * Increment page usage after a successful diary page submission
 */
export const incrementPageUsage = async (patientId: string) => {
  const subscription = await UserSubscription.findOne({
    where: { patientId, status: "ACTIVE" },
  });
  if (!subscription) throw new Error("No active subscription");
  subscription.pagesUsed += 1;
  await subscription.save();
  return subscription.pagesUsed;
};
