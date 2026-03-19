// src/routes/subscription.routes.ts

import express from "express";
import { authCheck, patientAuthCheck } from "../middleware/authMiddleware";
import { validate } from "../middleware/validate.middleware";
import { UserRole } from "../utils/constants";
import {
  createPlanSchema,
  updatePlanSchema,
  subscribeToPlanSchema,
  linkDoctorSchema,
} from "../schemas/subscription.schemas";
import {
  createPlan,
  updatePlan,
  deletePlan,
  getAllPlans,
  getPlanById,
  initiateSubscription,
  verifySubscriptionPayment,
  subscribeToPlan,
  linkDoctor,
  getMySubscription,
  getAllSubscriptions,
  upgradePlan,
  checkPageLimit,
  checkFeatureAccess,
} from "../controllers/subscription.controller";

const router = express.Router();

// ── Plan CRUD (Super Admin only) ─────────────────────────────────────────

router.post(
  "/plans",
  authCheck([UserRole.SUPER_ADMIN]),
  validate({ body: createPlanSchema }),
  createPlan
);

router.put(
  "/plans/:id",
  authCheck([UserRole.SUPER_ADMIN]),
  validate({ body: updatePlanSchema }),
  updatePlan
);

router.delete(
  "/plans/:id",
  authCheck([UserRole.SUPER_ADMIN]),
  deletePlan
);

// Get all plans (accessible to all authenticated users + patients)
router.get(
  "/plans",
  authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR, UserRole.DOCTOR, UserRole.ASSISTANT]),
  getAllPlans
);

router.get(
  "/plans/:id",
  authCheck([UserRole.SUPER_ADMIN, UserRole.VENDOR, UserRole.DOCTOR, UserRole.ASSISTANT]),
  getPlanById
);

// Public endpoint for patients to see plans
router.get(
  "/patient/plans",
  patientAuthCheck,
  async (req, res) => {
    // Reuse the same controller but force exclude inactive
    req.query.includeInactive = "false";
    return getAllPlans(req as any, res);
  }
);

// ── Subscription Payment Flow (Patient) ──────────────────────────────────

// Step 1: Create payment order for a subscription plan
router.post(
  "/subscribe",
  patientAuthCheck,
  initiateSubscription
);

// Step 2: Verify payment and activate subscription
router.post(
  "/verify-payment",
  patientAuthCheck,
  verifySubscriptionPayment
);

// Legacy: Direct subscribe (for free plans / backward compat)
router.post(
  "/subscribe-direct",
  patientAuthCheck,
  validate({ body: subscribeToPlanSchema }),
  subscribeToPlan
);

router.put(
  "/:subscriptionId/link-doctor",
  patientAuthCheck,
  validate({ body: linkDoctorSchema }),
  linkDoctor
);

router.get(
  "/my-subscription",
  patientAuthCheck,
  getMySubscription
);

router.post(
  "/upgrade",
  patientAuthCheck,
  upgradePlan
);

// ── Permission Check Endpoints (Patient) ─────────────────────────────────

router.get(
  "/check/page-limit",
  patientAuthCheck,
  checkPageLimit
);

router.get(
  "/check/features",
  patientAuthCheck,
  checkFeatureAccess
);

// ── Admin: All Subscriptions ─────────────────────────────────────────────

router.get(
  "/all",
  authCheck([UserRole.SUPER_ADMIN]),
  getAllSubscriptions
);

export default router;
