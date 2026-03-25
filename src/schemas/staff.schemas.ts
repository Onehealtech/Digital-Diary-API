import { z } from "zod";

const phoneSchema = z
  .string()
  .regex(/^\d{10}$/, "Phone must be exactly 10 digits")
  .optional();

const requiredPhoneSchema = z
  .string({ required_error: "Phone is required" })
  .regex(/^\d{10}$/, "Phone must be exactly 10 digits");

const landLineSchema = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return undefined;
    // Normalize: remove spaces, hyphens, parentheses
    let cleaned = v.replace(/[\s\-()]/g, "");
    if (!cleaned) return undefined;
    // Remove ONE prefix only
    if (cleaned.startsWith("+91")) cleaned = cleaned.slice(3);
    else if (cleaned.startsWith("91")) cleaned = cleaned.slice(2);
    else if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    return cleaned || undefined;
  })
  .refine((v) => !v || /^[0-9]{10}$/.test(v), {
    message: "Enter a valid Indian landline number (e.g. 011-23456789)",
  });

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

const bankSchema = z.object({
  accountHolder: z.string().max(100, "Account holder name must be 100 characters or less").optional(),
  accountNumber: z.string().max(20, "Account number must be 20 digits or less").optional(),
  ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid 11-character IFSC code (e.g. HDFC0001234)").optional(),
  bankName: z.string().max(100, "Bank name must be 100 characters or less").optional(),
}).optional();

// ── Create Staff (Super Admin creates Doctor/Vendor/SuperAdmin) ──
export const createStaffSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  role: z.enum(["DOCTOR", "VENDOR", "SUPER_ADMIN"], {
    required_error: "Role is required",
    invalid_type_error: "Invalid role",
  }),
  hospital: z.string().max(100).optional().transform(v => v?.trim() || undefined),
  specialization: z.string().max(100).optional().transform(v => v?.trim() || undefined),
  license: z.string().max(30).optional().transform(v => v?.trim() || undefined),
  GST: z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GST format"
    )
    .optional(),
  address: z.string().max(500, "Address must be 500 characters or less").optional().transform(v => v?.trim() || undefined),
  city: z.string().max(100, "City must be 100 characters or less").optional().transform(v => v?.trim() || undefined),
  state: z.string().max(100, "State must be 100 characters or less").optional().transform(v => v?.trim() || undefined),
  landLinePhone: landLineSchema,
  commissionType: z.any().transform((v) => {
    if (v === "FIXED" || v === "PERCENTAGE") return v as "FIXED" | "PERCENTAGE";
    return undefined;
  }).optional(),
  commissionRate: z.any().transform((v) => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = Number(v);
    return isNaN(n) || n < 0 ? undefined : n;
  }).optional(),
  bank: bankSchema,
  upi: z.string().optional(),
});

// ── Create Assistant (Doctor creates Assistant) ──
export const createAssistantSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  landLinePhone: landLineSchema,
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
  address: z.string({ required_error: "Address is required" }).min(1).max(500),
  city: z.string({ required_error: "City is required" }).min(1).max(100),
  state: z.string({ required_error: "State is required" }).min(1).max(100),
  gst: z
    .string({ required_error: "GST is required" })
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GST format. Expected: 2-digit state code + PAN + entity code + Z + checksum"
    ),
  landLinePhone: landLineSchema,
  bankDetails: bankSchema,
  commissionRate: z.number().min(0).optional(),
});
