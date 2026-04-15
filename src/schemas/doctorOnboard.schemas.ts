import { z } from "zod";

const phoneSchema = z
  .string()
  .regex(/^\d{10}$/, "Phone must be exactly 10 digits")
  .optional();

const emailSchema = z
  .string({ required_error: "Email is required" })
  .email("Enter a valid email address")
  .max(150, "Email must be 150 characters or less")
  .transform((v) => v.toLowerCase().trim());

const nameSchema = z
  .string({ required_error: "Full name is required" })
  .min(1, "Full name is required")
  .max(100, "Name must be 100 characters or less")
  .trim();

// Vendor submits a doctor onboard request
export const submitDoctorRequestSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  hospital: z.string().max(100).optional(),
  specialization: z.string().max(100).optional(),
  license: z.string().max(30).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  commissionType: z.enum(["FIXED", "PERCENTAGE"]).optional(),
  commissionRate: z.number().min(0).optional(),
  bank: z.record(z.unknown()).optional(),
});

// SuperAdmin rejects a request
export const rejectRequestSchema = z.object({
  rejectionReason: z
    .string({ required_error: "Rejection reason is required" })
    .min(1, "Rejection reason is required")
    .max(500),
});

// SuperAdmin assigns an existing doctor to a vendor
export const assignDoctorSchema = z.object({
  vendorId: z.string({ required_error: "Vendor ID is required" }).uuid("Invalid vendor ID"),
  doctorId: z.string({ required_error: "Doctor ID is required" }).uuid("Invalid doctor ID"),
});

// Query params for listing requests
export const listRequestsQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});
