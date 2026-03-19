// src/service/subscription.service.ts

import { Op } from "sequelize";
import { sequelize } from "../config/Dbconnetion";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { UserSubscription } from "../models/UserSubscription";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { Diary } from "../models/Diary";

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
// PATIENT SUBSCRIPTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Subscribe a patient to a plan.
 * Flow: Patient signs up → buys subscription → then chooses doctor.
 * Diary is NOT assigned here — it is assigned when a doctor accepts the request.
 */
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

    // 4. Create subscription with plan snapshot (no diary, no doctor yet)
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription

    const subscription = await UserSubscription.create(
      {
        patientId,
        planId,
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
// PLAN UPGRADE / DOWNGRADE
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

