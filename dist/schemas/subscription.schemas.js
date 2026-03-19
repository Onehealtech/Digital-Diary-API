"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionQuerySchema = exports.linkDoctorSchema = exports.subscribeToPlanSchema = exports.updatePlanSchema = exports.createPlanSchema = void 0;
const zod_1 = require("zod");
// ── Plan CRUD Schemas ────────────────────────────────────────────────────
exports.createPlanSchema = zod_1.z.object({
    name: zod_1.z
        .string({ required_error: "Plan name is required" })
        .min(1, "Plan name is required")
        .max(100, "Plan name must be 100 characters or less")
        .trim(),
    description: zod_1.z.string().max(500).optional(),
    monthlyPrice: zod_1.z.coerce
        .number({ required_error: "Monthly price is required" })
        .min(0, "Price must be non-negative"),
    maxDiaryPages: zod_1.z.coerce
        .number({ required_error: "Max diary pages is required" })
        .int("Must be a whole number")
        .min(-1, "Use -1 for unlimited, or a positive number"),
    scanEnabled: zod_1.z.coerce.boolean().default(false),
    manualEntryEnabled: zod_1.z.coerce.boolean().default(false),
    isPopular: zod_1.z.coerce.boolean().default(false),
    isActive: zod_1.z.coerce.boolean().default(true),
    sortOrder: zod_1.z.coerce.number().int().min(0).default(0),
});
exports.updatePlanSchema = exports.createPlanSchema.partial();
// ── Subscribe Schema (Patient) ───────────────────────────────────────────
exports.subscribeToPlanSchema = zod_1.z.object({
    planId: zod_1.z.string().uuid("Invalid plan ID"),
    paymentOrderId: zod_1.z.string().optional(),
    paymentMethod: zod_1.z.string().optional(),
});
// ── Link Doctor Schema ───────────────────────────────────────────────────
exports.linkDoctorSchema = zod_1.z.object({
    doctorId: zod_1.z.string().uuid("Invalid doctor ID"),
});
// ── Query Schemas ────────────────────────────────────────────────────────
exports.subscriptionQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(10),
    status: zod_1.z.enum(["ACTIVE", "EXPIRED", "CANCELLED", "UPGRADED"]).optional(),
});
