"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedAnalysisFilterSchema = exports.INVESTIGATIONS = void 0;
const zod_1 = require("zod");
// -----------------------------------------------------------------------
// INVESTIGATIONS constant
// -----------------------------------------------------------------------
exports.INVESTIGATIONS = [
    { key: "mammogram", label: "Mammogram" },
    { key: "usgBreast", label: "USG Breast" },
    { key: "biopsyBreast", label: "Biopsy (Breast)" },
    { key: "fnacAxillary", label: "FNAC (Axilla)" },
    { key: "petCt", label: "PET CT Scan" },
    { key: "mriBreasts", label: "MRI Breasts" },
    { key: "geneticTesting", label: "Genetic Testing" },
    { key: "mugaScan", label: "MUGA Scan" },
    { key: "echocardiography", label: "Echocardiography" },
    { key: "boneDexa", label: "Bone Dexa Scan" },
    { key: "ecg", label: "ECG" },
    { key: "chestXray", label: "Chest X-Ray" },
    { key: "bloodTests", label: "Blood Tests" },
    { key: "otherTests", label: "Other Tests" },
];
// -----------------------------------------------------------------------
// Zod Schemas
// -----------------------------------------------------------------------
const InvestigationStatusEnum = zod_1.z.enum([
    "ANY",
    "ORDERED_NOT_SCHEDULED",
    "SCHEDULED",
    "COMPLETED_NO_REPORT",
    "COMPLETED_REPORT_COLLECTED",
    "MISSED",
    "CANCELLED",
    "PROBLEM_FLAGGED",
]);
exports.AdvancedAnalysisFilterSchema = zod_1.z.object({
    search: zod_1.z.string().max(200).optional(),
    ageMin: zod_1.z.number().min(0).max(120).optional(),
    ageMax: zod_1.z.number().min(0).max(120).optional(),
    sex: zod_1.z.enum(["ALL", "FEMALE", "MALE", "OTHER"]).default("ALL"),
    submissionDateFrom: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
        .refine((v) => { const d = new Date(v); return !isNaN(d.getTime()) && d.toISOString().startsWith(v); }, "Invalid calendar date")
        .optional(),
    submissionDateTo: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)")
        .refine((v) => { const d = new Date(v); return !isNaN(d.getTime()) && d.toISOString().startsWith(v); }, "Invalid calendar date")
        .optional(),
    investigations: zod_1.z.record(InvestigationStatusEnum).optional(),
    nactPlanned: zod_1.z.enum(["ANY", "YES", "NO"]).default("ANY"),
    surgeryType: zod_1.z.enum(["ANY", "BCS", "MASTECTOMY", "NOT_PLANNED"]).default("ANY"),
    radiotherapyPlanned: zod_1.z.enum(["ANY", "YES", "NO"]).default("ANY"),
    treatmentNotDecided: zod_1.z.enum(["ANY", "YES", "NO"]).default("ANY"),
    nactStatus: zod_1.z.enum(["ANY", "NOT_STARTED", "IN_PROGRESS", "COMPLETED"]).default("ANY"),
    clipsBreast: zod_1.z.enum(["ANY", "YES", "NO"]).default("ANY"),
    clipsAxilla: zod_1.z.enum(["ANY", "YES", "NO"]).default("ANY"),
    tumorGrowingOnChemo: zod_1.z.enum(["ANY", "YES", "NO"]).default("ANY"),
    unableToCompleteChemo: zod_1.z.enum(["ANY", "YES", "NO"]).default("ANY"),
    chemoStartedClipsMissing: zod_1.z.enum(["ANY", "YES", "NO"]).default("ANY"),
    radiationBooked: zod_1.z.enum(["ANY", "YES", "NO", "MISSED", "CANCELLED"]).default("ANY"),
    surgeryAdmission: zod_1.z.enum(["ANY", "YES", "NO", "MISSED", "CANCELLED"]).default("ANY"),
    patientIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    page: zod_1.z.number().min(1).default(1),
    limit: zod_1.z.number().min(1).max(1000).default(20),
    sortBy: zod_1.z
        .enum(["name_asc", "name_desc", "most_issues", "latest_activity"])
        .default("name_asc"),
});
