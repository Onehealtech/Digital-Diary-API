import { z } from "zod";

// ── Plan CRUD Schemas ────────────────────────────────────────────────────

export const createPlanSchema = z.object({
  name: z
    .string({ required_error: "Plan name is required" })
    .min(1, "Plan name is required")
    .max(100, "Plan name must be 100 characters or less")
    .trim(),
  description: z.string().max(500).optional(),
  monthlyPrice: z.coerce
    .number({ required_error: "Monthly price is required" })
    .min(0, "Price must be non-negative"),
  maxDiaryPages: z.coerce
    .number({ required_error: "Max diary pages is required" })
    .int("Must be a whole number")
    .min(-1, "Use -1 for unlimited, or a positive number"),
  scanEnabled: z.coerce.boolean().default(false),
  manualEntryEnabled: z.coerce.boolean().default(false),
  isPopular: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const updatePlanSchema = createPlanSchema.partial();

// ── Subscribe Schema (Patient) ───────────────────────────────────────────

export const subscribeToPlanSchema = z.object({
  planId: z.string().uuid("Invalid plan ID"),
  paymentOrderId: z.string().optional(),
  paymentMethod: z.string().optional(),
});

// ── Link Doctor Schema ───────────────────────────────────────────────────

export const linkDoctorSchema = z.object({
  doctorId: z.string().uuid("Invalid doctor ID"),
});

// ── Query Schemas ────────────────────────────────────────────────────────

export const subscriptionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(["ACTIVE", "EXPIRED", "CANCELLED", "UPGRADED"]).optional(),
});
