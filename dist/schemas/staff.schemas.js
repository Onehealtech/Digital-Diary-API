"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVendorSchema = exports.registerPatientSchema = exports.createPatientSchema = exports.createAssistantSchema = exports.createStaffSchema = void 0;
const zod_1 = require("zod");
const phoneSchema = zod_1.z
    .string()
    .min(10, "Phone must be at least 10 digits")
    .max(13, "Phone must be 13 characters or less")
    .regex(/^\d{10,13}$/, "Phone must be 10–13 digits")
    .optional();
const requiredPhoneSchema = zod_1.z
    .string({ required_error: "Phone is required" })
    .min(10, "Phone must be at least 10 digits")
    .max(13, "Phone must be 13 characters or less")
    .regex(/^\d{10,13}$/, "Phone must be 10–13 digits");
const landLineSchema = zod_1.z
    .string()
    .optional()
    .transform((v) => {
    if (!v)
        return undefined;
    // Normalize: remove spaces, hyphens, parentheses
    let cleaned = v.replace(/[\s\-()]/g, "");
    if (!cleaned)
        return undefined;
    // Remove ONE prefix only
    if (cleaned.startsWith("+91"))
        cleaned = cleaned.slice(3);
    else if (cleaned.startsWith("91"))
        cleaned = cleaned.slice(2);
    else if (cleaned.startsWith("0"))
        cleaned = cleaned.slice(1);
    return cleaned || undefined;
})
    .refine((v) => !v || /^[0-9]{10}$/.test(v), {
    message: "Enter a valid Indian landline number (e.g. 011-23456789)",
});
const emailSchema = zod_1.z
    .string({ required_error: "Email is required" })
    .min(5, "Email must be at least 5 characters")
    .max(254, "Email must be 254 characters or less")
    .email("Enter a valid email address")
    .transform((v) => v.toLowerCase().trim());
const nameSchema = zod_1.z
    .string({ required_error: "Full name is required" })
    .min(1, "Full name is required")
    .max(100, "Name must be 100 characters or less")
    .trim();
const bankSchema = zod_1.z.object({
    accountHolder: zod_1.z.string().max(100, "Account holder name must be 100 characters or less").optional(),
    accountNumber: zod_1.z.string().max(20, "Account number must be 20 digits or less").optional(),
    ifsc: zod_1.z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid 11-character IFSC code (e.g. HDFC0001234)").optional(),
    bankName: zod_1.z.string().max(100, "Bank name must be 100 characters or less").optional(),
}).optional();
// ── Create Staff (Super Admin creates Doctor/Vendor/SuperAdmin) ──
exports.createStaffSchema = zod_1.z.object({
    fullName: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    role: zod_1.z.enum(["DOCTOR", "VENDOR", "SUPER_ADMIN"], {
        required_error: "Role is required",
        invalid_type_error: "Invalid role",
    }),
    hospital: zod_1.z.string().max(100, "Hospital must be 100 characters or less").optional().transform(v => v?.trim() || undefined),
    specialization: zod_1.z.string().max(100, "Specialization must be 100 characters or less").optional().transform(v => v?.trim() || undefined),
    license: zod_1.z.string().max(50, "License must be 50 characters or less").optional().transform(v => v?.trim() || undefined),
    GST: zod_1.z
        .string()
        .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GST format")
        .optional(),
    address: zod_1.z.string().max(255, "Address must be 255 characters or less").optional().transform(v => v?.trim() || undefined),
    city: zod_1.z.string().max(50, "City must be 50 characters or less").regex(/^[A-Za-z\s]*$/, "City must contain only letters and spaces").optional().transform(v => v?.trim() || undefined),
    state: zod_1.z.string().max(50, "State must be 50 characters or less").regex(/^[A-Za-z\s]*$/, "State must contain only letters and spaces").optional().transform(v => v?.trim() || undefined),
    landLinePhone: landLineSchema,
    commissionType: zod_1.z.any().transform((v) => {
        if (v === "FIXED" || v === "PERCENTAGE")
            return v;
        return undefined;
    }).optional(),
    commissionRate: zod_1.z.any().transform((v) => {
        if (v === null || v === undefined || v === "")
            return undefined;
        const n = Number(v);
        return isNaN(n) || n < 0 ? undefined : n;
    }).optional(),
    bank: bankSchema,
    upi: zod_1.z.string().optional(),
});
// ── Create Assistant (Doctor creates Assistant) ──
exports.createAssistantSchema = zod_1.z.object({
    fullName: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    landLinePhone: landLineSchema,
});
// ── Create Patient (Vendor creates Patient) ──
exports.createPatientSchema = zod_1.z.object({
    fullName: nameSchema,
    age: zod_1.z.coerce.number().int().min(0, "Age must be positive").max(150, "Invalid age").optional(),
    gender: zod_1.z.string().optional(),
    phone: requiredPhoneSchema,
    diaryId: zod_1.z.string({ required_error: "Diary ID is required" }).min(1, "Diary ID is required"),
    doctorId: zod_1.z.string({ required_error: "Doctor ID is required" }).uuid("Invalid doctor ID"),
});
// ── Register Patient (Doctor/Assistant registers Patient via clinic) ──
exports.registerPatientSchema = zod_1.z.object({
    fullName: nameSchema,
    diaryId: zod_1.z.string({ required_error: "Sticker ID is required" }).min(1, "Sticker ID is required"),
    age: zod_1.z.coerce.number().int().min(0).max(150).optional(),
    phone: phoneSchema,
    gender: zod_1.z.string().optional(),
    caseType: zod_1.z.string().optional(),
});
// ── Create Vendor (via vendor controller) ──
exports.createVendorSchema = zod_1.z.object({
    fullName: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
    businessName: zod_1.z.string({ required_error: "Business name is required" }).min(1),
    address: zod_1.z.string({ required_error: "Address is required" }).min(1).max(500),
    city: zod_1.z.string({ required_error: "City is required" }).min(1).max(100),
    state: zod_1.z.string({ required_error: "State is required" }).min(1).max(100),
    gst: zod_1.z
        .string({ required_error: "GST is required" })
        .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GST format. Expected: 2-digit state code + PAN + entity code + Z + checksum"),
    landLinePhone: landLineSchema,
    bankDetails: bankSchema,
    commissionRate: zod_1.z.number().min(0).optional(),
});
