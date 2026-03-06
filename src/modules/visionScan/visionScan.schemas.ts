import { z } from "zod";

const coercedPageNumber = z
    .union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
    .pipe(z.number().int().positive("pageNumber must be a positive integer"));

const paginationFields = {
    page: z
        .string()
        .optional()
        .default("1")
        .transform(Number)
        .pipe(z.number().int().positive()),
    limit: z
        .string()
        .optional()
        .default("20")
        .transform(Number)
        .pipe(z.number().int().min(1).max(100)),
};

const dateString = z.string().refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Invalid date format" }
);

export const uploadScanSchema = z.object({
    pageNumber: coercedPageNumber,
});

export const manualSubmitSchema = z.object({
    pageNumber: coercedPageNumber,
    answers: z.record(z.string(), z.string()).refine(
        (val) => Object.keys(val).length > 0,
        { message: "answers must not be empty" }
    ),
});

export const scanIdParamSchema = z.object({
    id: z.string().uuid("Invalid scan ID format"),
});

export const reviewScanSchema = z.object({
    doctorNotes: z.string().optional(),
    flagged: z.boolean().optional(),
    overrides: z.record(z.string(), z.string()).optional(),
});

export const paginationQuerySchema = z.object(paginationFields);

export const allScansQuerySchema = z.object({
    ...paginationFields,
    processingStatus: z
        .enum(["pending", "processing", "completed", "failed"])
        .optional(),
    patientId: z.string().uuid().optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    reviewed: z
        .enum(["true", "false"])
        .optional()
        .transform((val) => (val !== undefined ? val === "true" : undefined)),
    flagged: z
        .enum(["true", "false"])
        .optional()
        .transform((val) => (val !== undefined ? val === "true" : undefined)),
});
