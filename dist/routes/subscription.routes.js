"use strict";
// src/routes/subscription.routes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const constants_1 = require("../utils/constants");
const subscription_schemas_1 = require("../schemas/subscription.schemas");
const subscription_controller_1 = require("../controllers/subscription.controller");
const router = express_1.default.Router();
// ── Plan CRUD (Super Admin only) ─────────────────────────────────────────
router.post("/plans", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), (0, validate_middleware_1.validate)({ body: subscription_schemas_1.createPlanSchema }), subscription_controller_1.createPlan);
router.put("/plans/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), (0, validate_middleware_1.validate)({ body: subscription_schemas_1.updatePlanSchema }), subscription_controller_1.updatePlan);
router.delete("/plans/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), subscription_controller_1.deletePlan);
// Get all plans (accessible to all authenticated users + patients)
router.get("/plans", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), subscription_controller_1.getAllPlans);
router.get("/plans/:id", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN, constants_1.UserRole.VENDOR, constants_1.UserRole.DOCTOR, constants_1.UserRole.ASSISTANT]), subscription_controller_1.getPlanById);
// Public endpoint for patients to see plans
router.get("/patient/plans", 
// patientAuthCheck,
async (req, res) => {
    // Reuse the same controller but force exclude inactive
    req.query.includeInactive = "false";
    return (0, subscription_controller_1.getAllPlans)(req, res);
});
// ── Subscription Payment Flow (Patient) ──────────────────────────────────
// Step 1: Create payment order for a subscription plan
router.post("/subscribe", authMiddleware_1.patientAuthCheck, subscription_controller_1.initiateSubscription);
// Step 2: Verify payment and activate subscription
router.post("/verify-payment", authMiddleware_1.patientAuthCheck, subscription_controller_1.verifySubscriptionPayment);
// Legacy: Direct subscribe (for free plans / backward compat)
router.post("/subscribe-direct", authMiddleware_1.patientAuthCheck, (0, validate_middleware_1.validate)({ body: subscription_schemas_1.subscribeToPlanSchema }), subscription_controller_1.subscribeToPlan);
router.put("/:subscriptionId/link-doctor", authMiddleware_1.patientAuthCheck, (0, validate_middleware_1.validate)({ body: subscription_schemas_1.linkDoctorSchema }), subscription_controller_1.linkDoctor);
router.get("/my-subscription", authMiddleware_1.patientAuthCheck, subscription_controller_1.getMySubscription);
router.post("/upgrade", authMiddleware_1.patientAuthCheck, subscription_controller_1.upgradePlan);
// ── Permission Check Endpoints (Patient) ─────────────────────────────────
router.get("/check/page-limit", authMiddleware_1.patientAuthCheck, subscription_controller_1.checkPageLimit);
router.get("/check/features", authMiddleware_1.patientAuthCheck, subscription_controller_1.checkFeatureAccess);
// ── Admin: All Subscriptions ─────────────────────────────────────────────
router.get("/all", (0, authMiddleware_1.authCheck)([constants_1.UserRole.SUPER_ADMIN]), subscription_controller_1.getAllSubscriptions);
exports.default = router;
