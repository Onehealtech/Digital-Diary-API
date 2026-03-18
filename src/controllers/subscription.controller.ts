// src/controllers/subscription.controller.ts

import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { responseMiddleware } from "../utils/response";
import { HTTP_STATUS } from "../utils/constants";
import * as subscriptionService from "../service/subscription.service";

// ═══════════════════════════════════════════════════════════════════════════
// PLAN CRUD (Super Admin)
// ═══════════════════════════════════════════════════════════════════════════

export const createPlan = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const plan = await subscriptionService.createPlan(req.body);
    return responseMiddleware(res, HTTP_STATUS.CREATED, "Subscription plan created successfully", plan);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create plan";
    return responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
};

export const updatePlan = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const plan = await subscriptionService.updatePlan(id, req.body);
    return responseMiddleware(res, HTTP_STATUS.OK, "Plan updated successfully", plan);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update plan";
    const status = message === "Plan not found" ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    return responseMiddleware(res, status, message);
  }
};

export const deletePlan = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = await subscriptionService.deletePlan(id);
    return responseMiddleware(res, HTTP_STATUS.OK, result.message);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete plan";
    const status = message === "Plan not found" ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST;
    return responseMiddleware(res, status, message);
  }
};

export const getAllPlans = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const plans = await subscriptionService.getAllPlans(includeInactive);
    return responseMiddleware(res, HTTP_STATUS.OK, "Plans fetched successfully", plans);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch plans";
    return responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
};

export const getPlanById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const plan = await subscriptionService.getPlanById(id);
    return responseMiddleware(res, HTTP_STATUS.OK, "Plan fetched successfully", plan);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch plan";
    const status = message === "Plan not found" ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.INTERNAL_SERVER_ERROR;
    return responseMiddleware(res, status, message);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// PATIENT SUBSCRIPTION
// ═══════════════════════════════════════════════════════════════════════════

export const subscribeToPlan = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.user.id; // from patient auth
    const { planId, doctorId, paymentOrderId, paymentMethod } = req.body;

    const result = await subscriptionService.subscribeToPlan({
      patientId,
      planId,
      doctorId,
      paymentOrderId,
      paymentMethod,
    });

    return responseMiddleware(res, HTTP_STATUS.CREATED, "Subscription created successfully", result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Subscription failed";
    return responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, message);
  }
};

export const linkDoctor = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const subscriptionId = req.params.subscriptionId as string;
    const { doctorId } = req.body;

    const result = await subscriptionService.linkDoctor(subscriptionId, doctorId);
    return responseMiddleware(res, HTTP_STATUS.OK, "Doctor linked successfully", result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to link doctor";
    return responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, message);
  }
};

export const getMySubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.user.id;
    const subscription = await subscriptionService.getPatientSubscription(patientId);

    if (!subscription) {
      return responseMiddleware(res, HTTP_STATUS.NOT_FOUND, "No active subscription found");
    }

    return responseMiddleware(res, HTTP_STATUS.OK, "Subscription fetched successfully", subscription);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch subscription";
    return responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
};

export const getAllSubscriptions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string | undefined;

    const result = await subscriptionService.getAllSubscriptions({ page, limit, status });
    return responseMiddleware(res, HTTP_STATUS.OK, "Subscriptions fetched successfully", result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch subscriptions";
    return responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// PLAN UPGRADE
// ═══════════════════════════════════════════════════════════════════════════

export const upgradePlan = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.user.id;
    const { newPlanId, paymentOrderId, paymentMethod } = req.body;

    const result = await subscriptionService.upgradePlan({
      patientId,
      newPlanId,
      paymentOrderId,
      paymentMethod,
    });

    return responseMiddleware(res, HTTP_STATUS.OK, "Plan upgraded successfully", result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upgrade failed";
    return responseMiddleware(res, HTTP_STATUS.BAD_REQUEST, message);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// PERMISSION CHECK ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

export const checkPageLimit = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.user.id;
    const result = await subscriptionService.canAddDiaryPage(patientId);
    return responseMiddleware(res, HTTP_STATUS.OK, "Page limit status", result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to check page limit";
    return responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
};

export const checkFeatureAccess = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.user.id;
    const scanEnabled = await subscriptionService.isScanEnabled(patientId);
    const manualEntryEnabled = await subscriptionService.isManualEntryEnabled(patientId);

    return responseMiddleware(res, HTTP_STATUS.OK, "Feature access status", {
      scanEnabled,
      manualEntryEnabled,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to check features";
    return responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
};
