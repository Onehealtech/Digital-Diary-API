"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVendorSchema = exports.registerPatientSchema = exports.createPatientSchema = exports.createAssistantSchema = exports.createStaffSchema = void 0;
const zod_1 = require("zod");
const phoneSchema = zod_1.z
    .string()
    .regex(/^\d{10}$/, "Phone must be exactly 10 digits")
    .optional();
const requiredPhoneSchema = zod_1.z
    .string({ required_error: "Phone is required" })
    .regex(/^\d{10}$/, "Phone must be exactly 10 digits");
const emailSchema = zod_1.z
    .string({ required_error: "Email is required" })
    .email("Enter a valid email address")
    .max(150, "Email must be 150 characters or less")
    .transform((v) => v.toLowerCase().trim());
const nameSchema = zod_1.z
    .string({ required_error: "Full name is required" })
    .min(1, "Full name is required")
    .max(100, "Name must be 100 characters or less")
    .trim();
// ── Create Staff (Super Admin creates Doctor/Vendor/SuperAdmin) ──
exports.createStaffSchema = zod_1.z.object({
    fullName: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    role: zod_1.z.enum(["DOCTOR", "VENDOR", "SUPER_ADMIN"], {
        required_error: "Role is required",
        invalid_type_error: "Invalid role",
    }),
    hospital: zod_1.z.string().max(100).optional(),
    specialization: zod_1.z.string().max(100).optional(),
    license: zod_1.z.string().max(30).optional(),
    GST: zod_1.z.string().length(15, "GST must be 15 characters").optional(),
    location: zod_1.z.string().max(200).optional(),
    commissionType: zod_1.z.enum(["FIXED", "PERCENTAGE"]).optional(),
    commissionRate: zod_1.z.number().min(0).optional(),
    bank: zod_1.z.record(zod_1.z.unknown()).optional(),
    upi: zod_1.z.string().optional(),
});
// ── Create Assistant (Doctor creates Assistant) ──
exports.createAssistantSchema = zod_1.z.object({
    fullName: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
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
    location: zod_1.z.string({ required_error: "Location is required" }).min(1),
    gst: zod_1.z.string({ required_error: "GST is required" }).length(15, "GST must be 15 characters"),
    bankDetails: zod_1.z.record(zod_1.z.unknown(), { required_error: "Bank details are required" }),
    commissionRate: zod_1.z.number().min(0).optional(),
});
