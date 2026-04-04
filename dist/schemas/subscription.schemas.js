"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionQuerySchema = exports.linkDoctorSchema = exports.subscribeToPlanSchema = exports.updatePlanSchema = exports.createPlanSchema = void 0;
const zod_1 = require("zod");
// Plan CRUD schemas
const PLAN_NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;
const PRICE_MAX_INPUT_LENGTH = 10; // aligned with DECIMAL(10,2)
const MAX_DIARY_PAGES_INPUT_LENGTH = 7; // supports -1 and large positive integers
const monthlyPriceSchema = zod_1.z
    .union([
    zod_1.z.number(),
    zod_1.z
        .string()
        .trim()
        .min(1, "Price is required")
        .max(PRICE_MAX_INPUT_LENGTH, `Price must be ${PRICE_MAX_INPUT_LENGTH} characters or less`),
])
    .transform((value) => Number(value))
    .refine((value) => Number.isFinite(value), "Price must be a valid number")
    .refine((value) => value >= 0, "Price must be non-negative")
    .refine((value) => value <= 99999999.99, "Price exceeds allowed limit")
    .refine((value) => Number.isInteger(value * 100), "Price can have at most 2 decimal places");
const maxDiaryPagesSchema = zod_1.z
    .union([
    zod_1.z.number(),
    zod_1.z
        .string()
        .trim()
        .min(1, "Max diary pages is required")
        .max(MAX_DIARY_PAGES_INPUT_LENGTH, `Max diary pages must be ${MAX_DIARY_PAGES_INPUT_LENGTH} characters or less`),
])
    .transform((value) => Number(value))
    .refine((value) => Number.isInteger(value), "Max diary pages must be a whole number")
    .refine((value) => value === -1 || value > 0, "Use -1 for unlimited, or a positive number");
exports.createPlanSchema = zod_1.z.object({
    name: zod_1.z
        .string({ required_error: "Plan name is required" })
        .trim()
        .min(1, "Plan name is required")
        .max(PLAN_NAME_MAX_LENGTH, `Plan name must be ${PLAN_NAME_MAX_LENGTH} characters or less`),
    description: zod_1.z
        .string()
        .trim()
        .max(DESCRIPTION_MAX_LENGTH, `Description must be ${DESCRIPTION_MAX_LENGTH} characters or less`)
        .optional(),
    monthlyPrice: monthlyPriceSchema,
    maxDiaryPages: maxDiaryPagesSchema,
    scanEnabled: zod_1.z.coerce.boolean().default(false),
    manualEntryEnabled: zod_1.z.coerce.boolean().default(false),
    isPopular: zod_1.z.coerce.boolean().default(false),
    isActive: zod_1.z.coerce.boolean().default(true),
    sortOrder: zod_1.z.coerce.number().int().min(0).default(0),
});
exports.updatePlanSchema = exports.createPlanSchema.partial();
// Subscribe schema (Patient)
exports.subscribeToPlanSchema = zod_1.z.object({
    planId: zod_1.z.string().uuid("Invalid plan ID"),
    paymentOrderId: zod_1.z.string().optional(),
    paymentMethod: zod_1.z.string().optional(),
});
// Link Doctor schema
exports.linkDoctorSchema = zod_1.z.object({
    doctorId: zod_1.z.string().uuid("Invalid doctor ID"),
});
// Query schemas
exports.subscriptionQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(10),
    status: zod_1.z.enum(["ACTIVE", "EXPIRED", "CANCELLED", "UPGRADED"]).optional(),
});
