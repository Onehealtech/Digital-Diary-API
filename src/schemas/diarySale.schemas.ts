import { z } from "zod";

export const sellDiarySchema = z.object({
  diaryId: z.string({ required_error: "Diary ID is required" }).min(1, "Diary ID is required"),
  patientName: z
    .string({ required_error: "Patient name is required" })
    .min(1, "Patient name is required")
    .max(100, "Name must be 100 characters or less")
    .trim(),
  age: z.coerce.number().int().min(0, "Age must be positive").max(150, "Invalid age"),
  gender: z.string({ required_error: "Gender is required" }).min(1, "Gender is required"),
  phone: z
    .string({ required_error: "Phone is required" })
    .regex(/^\d{10}$/, "Phone must be exactly 10 digits"),
  address: z.string().max(500).optional(),
  doctorId: z.string().uuid("Invalid doctor ID").optional(),
  paymentAmount: z.coerce.number().min(0, "Payment amount must be positive").default(500),
  caseType: z
    .enum(["PERI_OPERATIVE", "POST_OPERATIVE", "FOLLOW_UP", "CHEMOTHERAPY", "RADIOLOGY"])
    .optional(),
});

export const requestDiariesSchema = z.object({
  quantity: z.coerce.number().int().min(1, "Minimum 1 diary").max(500, "Maximum 500 diaries"),
  message: z.string().max(500).optional(),
  diaryType: z.string().optional(),
});
