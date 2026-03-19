"use strict";
// src/controllers/subscription.controller.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFeatureAccess = exports.checkPageLimit = exports.upgradePlan = exports.getAllSubscriptions = exports.getMySubscription = exports.linkDoctor = exports.subscribeToPlan = exports.getPlanById = exports.getAllPlans = exports.deletePlan = exports.updatePlan = exports.createPlan = void 0;
const response_1 = require("../utils/response");
const constants_1 = require("../utils/constants");
const subscriptionService = __importStar(require("../service/subscription.service"));
// ═══════════════════════════════════════════════════════════════════════════
// PLAN CRUD (Super Admin)
// ═══════════════════════════════════════════════════════════════════════════
const createPlan = async (req, res) => {
    try {
        const plan = await subscriptionService.createPlan(req.body);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.CREATED, "Subscription plan created successfully", plan);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create plan";
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
exports.createPlan = createPlan;
const updatePlan = async (req, res) => {
    try {
        const id = req.params.id;
        const plan = await subscriptionService.updatePlan(id, req.body);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Plan updated successfully", plan);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update plan";
        const status = message === "Plan not found" ? constants_1.HTTP_STATUS.NOT_FOUND : constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR;
        return (0, response_1.responseMiddleware)(res, status, message);
    }
};
exports.updatePlan = updatePlan;
const deletePlan = async (req, res) => {
    try {
        const id = req.params.id;
        const result = await subscriptionService.deletePlan(id);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, result.message);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete plan";
        const status = message === "Plan not found" ? constants_1.HTTP_STATUS.NOT_FOUND : constants_1.HTTP_STATUS.BAD_REQUEST;
        return (0, response_1.responseMiddleware)(res, status, message);
    }
};
exports.deletePlan = deletePlan;
const getAllPlans = async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive === "true";
        const plans = await subscriptionService.getAllPlans(includeInactive);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Plans fetched successfully", plans);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch plans";
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
exports.getAllPlans = getAllPlans;
const getPlanById = async (req, res) => {
    try {
        const id = req.params.id;
        const plan = await subscriptionService.getPlanById(id);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Plan fetched successfully", plan);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch plan";
        const status = message === "Plan not found" ? constants_1.HTTP_STATUS.NOT_FOUND : constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR;
        return (0, response_1.responseMiddleware)(res, status, message);
    }
};
exports.getPlanById = getPlanById;
// ═══════════════════════════════════════════════════════════════════════════
// PATIENT SUBSCRIPTION
// ═══════════════════════════════════════════════════════════════════════════
const subscribeToPlan = async (req, res) => {
    try {
        const patientId = req.user.id; // from patient auth
        const { planId, paymentOrderId, paymentMethod } = req.body;
        const result = await subscriptionService.subscribeToPlan({
            patientId,
            planId,
            paymentOrderId,
            paymentMethod,
        });
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.CREATED, "Subscription created successfully", result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Subscription failed";
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, message);
    }
};
exports.subscribeToPlan = subscribeToPlan;
const linkDoctor = async (req, res) => {
    try {
        const subscriptionId = req.params.subscriptionId;
        const { doctorId } = req.body;
        const result = await subscriptionService.linkDoctor(subscriptionId, doctorId);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Doctor linked successfully", result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to link doctor";
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, message);
    }
};
exports.linkDoctor = linkDoctor;
const getMySubscription = async (req, res) => {
    try {
        const patientId = req.user.id;
        const subscription = await subscriptionService.getPatientSubscription(patientId);
        if (!subscription) {
            return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.NOT_FOUND, "No active subscription found");
        }
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Subscription fetched successfully", subscription);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch subscription";
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
exports.getMySubscription = getMySubscription;
const getAllSubscriptions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const result = await subscriptionService.getAllSubscriptions({ page, limit, status });
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Subscriptions fetched successfully", result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch subscriptions";
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
exports.getAllSubscriptions = getAllSubscriptions;
// ═══════════════════════════════════════════════════════════════════════════
// PLAN UPGRADE
// ═══════════════════════════════════════════════════════════════════════════
const upgradePlan = async (req, res) => {
    try {
        const patientId = req.user.id;
        const { newPlanId, paymentOrderId, paymentMethod } = req.body;
        const result = await subscriptionService.upgradePlan({
            patientId,
            newPlanId,
            paymentOrderId,
            paymentMethod,
        });
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Plan upgraded successfully", result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Upgrade failed";
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, message);
    }
};
exports.upgradePlan = upgradePlan;
// ═══════════════════════════════════════════════════════════════════════════
// PERMISSION CHECK ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════
const checkPageLimit = async (req, res) => {
    try {
        const patientId = req.user.id;
        const result = await subscriptionService.canAddDiaryPage(patientId);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Page limit status", result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to check page limit";
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
exports.checkPageLimit = checkPageLimit;
const checkFeatureAccess = async (req, res) => {
    try {
        const patientId = req.user.id;
        const scanEnabled = await subscriptionService.isScanEnabled(patientId);
        const manualEntryEnabled = await subscriptionService.isManualEntryEnabled(patientId);
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Feature access status", {
            scanEnabled,
            manualEntryEnabled,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to check features";
        return (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
exports.checkFeatureAccess = checkFeatureAccess;
