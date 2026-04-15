"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allScansQuerySchema = exports.paginationQuerySchema = exports.reviewScanSchema = exports.scanIdParamSchema = exports.manualSubmitSchema = exports.uploadScanSchema = void 0;
const zod_1 = require("zod");
const coercedPageNumber = zod_1.z
    .union([zod_1.z.number(), zod_1.z.string().regex(/^\d+$/).transform(Number)])
    .pipe(zod_1.z.number().int().positive("pageNumber must be a positive integer"));
const paginationFields = {
    page: zod_1.z
        .string()
        .optional()
        .default("1")
        .transform(Number)
        .pipe(zod_1.z.number().int().positive()),
    limit: zod_1.z
        .string()
        .optional()
        .default("20")
        .transform(Number)
        .pipe(zod_1.z.number().int().min(1).max(100)),
};
const dateString = zod_1.z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" });
exports.uploadScanSchema = zod_1.z.object({
    pageNumber: coercedPageNumber.optional(),
});
exports.manualSubmitSchema = zod_1.z.object({
    pageNumber: coercedPageNumber,
    answers: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).refine((val) => Object.keys(val).length > 0, { message: "answers must not be empty" }),
});
exports.scanIdParamSchema = zod_1.z.object({
    id: zod_1.z.string().uuid("Invalid scan ID format"),
});
exports.reviewScanSchema = zod_1.z.object({
    doctorNotes: zod_1.z.string().optional(),
    flagged: zod_1.z.boolean().optional(),
    overrides: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
});
exports.paginationQuerySchema = zod_1.z.object(paginationFields);
exports.allScansQuerySchema = zod_1.z.object({
    ...paginationFields,
    processingStatus: zod_1.z
        .enum(["pending", "processing", "completed", "failed"])
        .optional(),
    patientId: zod_1.z.string().uuid().optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    reviewed: zod_1.z
        .enum(["true", "false"])
        .optional()
        .transform((val) => (val !== undefined ? val === "true" : undefined)),
    flagged: zod_1.z
        .enum(["true", "false"])
        .optional()
        .transform((val) => (val !== undefined ? val === "true" : undefined)),
});
