"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRequestsQuerySchema = exports.assignDoctorSchema = exports.rejectRequestSchema = exports.submitDoctorRequestSchema = void 0;
const zod_1 = require("zod");
const phoneSchema = zod_1.z
    .string()
    .regex(/^\d{10}$/, "Phone must be exactly 10 digits")
    .optional();
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
// Vendor submits a doctor onboard request
exports.submitDoctorRequestSchema = zod_1.z.object({
    fullName: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    hospital: zod_1.z.string().max(100).optional(),
    specialization: zod_1.z.string().max(100).optional(),
    license: zod_1.z.string().max(30).optional(),
    address: zod_1.z.string().max(500).optional(),
    city: zod_1.z.string().max(100).optional(),
    state: zod_1.z.string().max(100).optional(),
    commissionType: zod_1.z.enum(["FIXED", "PERCENTAGE"]).optional(),
    commissionRate: zod_1.z.number().min(0).optional(),
    bank: zod_1.z.record(zod_1.z.unknown()).optional(),
});
// SuperAdmin rejects a request
exports.rejectRequestSchema = zod_1.z.object({
    rejectionReason: zod_1.z
        .string({ required_error: "Rejection reason is required" })
        .min(1, "Rejection reason is required")
        .max(500),
});
// SuperAdmin assigns an existing doctor to a vendor
exports.assignDoctorSchema = zod_1.z.object({
    vendorId: zod_1.z.string({ required_error: "Vendor ID is required" }).uuid("Invalid vendor ID"),
    doctorId: zod_1.z.string({ required_error: "Doctor ID is required" }).uuid("Invalid doctor ID"),
});
// Query params for listing requests
exports.listRequestsQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().optional(),
});
