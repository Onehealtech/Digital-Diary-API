import { z } from "zod";

const phoneSchema = z
  .string()
  .regex(/^\d{10}$/, "Phone must be exactly 10 digits")
  .optional();

const requiredPhoneSchema = z
  .string({ required_error: "Phone is required" })
  .regex(/^\d{10}$/, "Phone must be exactly 10 digits");

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

// ── Create Staff (Super Admin creates Doctor/Vendor/SuperAdmin) ──
export const createStaffSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  role: z.enum(["DOCTOR", "VENDOR", "SUPER_ADMIN"], {
    required_error: "Role is required",
    invalid_type_error: "Invalid role",
  }),
  hospital: z.string().max(100).optional(),
  specialization: z.string().max(100).optional(),
  license: z.string().max(30).optional(),
  GST: z.string().length(15, "GST must be 15 characters").optional(),
  location: z.string().max(200).optional(),
  commissionType: z.enum(["FIXED", "PERCENTAGE"]).optional(),
  commissionRate: z.number().min(0).optional(),
  bank: z.record(z.unknown()).optional(),
  upi: z.string().optional(),
});

// ── Create Assistant (Doctor creates Assistant) ──
export const createAssistantSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
});

// ── Create Patient (Vendor creates Patient) ──
export const createPatientSchema = z.object({
  fullName: nameSchema,
  age: z.coerce.number().int().min(0, "Age must be positive").max(150, "Invalid age").optional(),
  gender: z.string().optional(),
  phone: requiredPhoneSchema,
  diaryId: z.string({ required_error: "Diary ID is required" }).min(1, "Diary ID is required"),
  doctorId: z.string({ required_error: "Doctor ID is required" }).uuid("Invalid doctor ID"),
});

// ── Register Patient (Doctor/Assistant registers Patient via clinic) ──
export const registerPatientSchema = z.object({
  fullName: nameSchema,
  diaryId: z.string({ required_error: "Sticker ID is required" }).min(1, "Sticker ID is required"),
  age: z.coerce.number().int().min(0).max(150).optional(),
  phone: phoneSchema,
  gender: z.string().optional(),
  caseType: z.string().optional(),
});

// ── Create Vendor (via vendor controller) ──
export const createVendorSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
  businessName: z.string({ required_error: "Business name is required" }).min(1),
  location: z.string({ required_error: "Location is required" }).min(1),
  gst: z.string({ required_error: "GST is required" }).length(15, "GST must be 15 characters"),
  bankDetails: z.record(z.unknown(), { required_error: "Bank details are required" }),
  commissionRate: z.number().min(0).optional(),
});
