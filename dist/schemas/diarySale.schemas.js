"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestDiariesSchema = exports.sellDiarySchema = void 0;
const zod_1 = require("zod");
exports.sellDiarySchema = zod_1.z.object({
    diaryId: zod_1.z.string({ required_error: "Diary ID is required" }).min(1, "Diary ID is required"),
    patientName: zod_1.z
        .string({ required_error: "Patient name is required" })
        .min(1, "Patient name is required")
        .max(100, "Name must be 100 characters or less")
        .trim(),
    age: zod_1.z.coerce.number().int().min(0, "Age must be positive").max(150, "Invalid age"),
    gender: zod_1.z.string({ required_error: "Gender is required" }).min(1, "Gender is required"),
    phone: zod_1.z
        .string({ required_error: "Phone is required" })
        .regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
    address: zod_1.z.string().max(500).optional(),
    doctorId: zod_1.z.string().uuid("Invalid doctor ID").optional(),
    paymentAmount: zod_1.z.coerce.number().min(0, "Payment amount must be positive").default(500),
    caseType: zod_1.z
        .enum(["PERI_OPERATIVE", "POST_OPERATIVE", "FOLLOW_UP", "CHEMOTHERAPY", "RADIOLOGY"])
        .optional(),
});
exports.requestDiariesSchema = zod_1.z.object({
    quantity: zod_1.z.coerce.number().int().min(1, "Minimum 1 diary").max(500, "Maximum 500 diaries"),
    message: zod_1.z.string().max(500).optional(),
    diaryType: zod_1.z.string().optional(),
});
