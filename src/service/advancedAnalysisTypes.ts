import { z } from "zod";

// -----------------------------------------------------------------------
// INVESTIGATIONS constant
// -----------------------------------------------------------------------
export const INVESTIGATIONS = [
  { key: "mammogram",        label: "Mammogram" },
  { key: "usgBreast",        label: "USG Breast" },
  { key: "biopsyBreast",     label: "Biopsy (Breast)" },
  { key: "fnacAxillary",     label: "FNAC (Axilla)" },
  { key: "petCt",            label: "PET CT Scan" },
  { key: "mriBreasts",       label: "MRI Breasts" },
  { key: "geneticTesting",   label: "Genetic Testing" },
  { key: "mugaScan",         label: "MUGA Scan" },
  { key: "echocardiography", label: "Echocardiography" },
  { key: "boneDexa",         label: "Bone Dexa Scan" },
  { key: "ecg",              label: "ECG" },
  { key: "chestXray",        label: "Chest X-Ray" },
  { key: "bloodTests",       label: "Blood Tests" },
  { key: "otherTests",       label: "Other Tests" },
] as const;

export type InvestigationKey = (typeof INVESTIGATIONS)[number]["key"];

// -----------------------------------------------------------------------
// Zod Schemas
// -----------------------------------------------------------------------

const InvestigationStatusEnum = z.enum([
  "ANY",
  "ORDERED_NOT_SCHEDULED",
  "SCHEDULED",
  "COMPLETED_NO_REPORT",
  "COMPLETED_REPORT_COLLECTED",
  "MISSED",
  "CANCELLED",
  "PROBLEM_FLAGGED",
]);

export const AdvancedAnalysisFilterSchema = z.object({
  search: z.string().max(200).optional(),
  ageMin: z.number().min(0).max(120).optional(),
  ageMax: z.number().min(0).max(120).optional(),
  sex: z.enum(["ALL", "FEMALE", "MALE", "OTHER"]).default("ALL"),
  submissionDateFrom: z.string().optional(), // ISO date string (YYYY-MM-DD)
  submissionDateTo: z.string().optional(),   // ISO date string (YYYY-MM-DD)
  investigations: z.record(InvestigationStatusEnum).optional(),
  nactPlanned: z.enum(["ANY", "YES", "NO"]).default("ANY"),
  surgeryType: z.enum(["ANY", "BCS", "MASTECTOMY", "NOT_PLANNED"]).default("ANY"),
  radiotherapyPlanned: z.enum(["ANY", "YES", "NO"]).default("ANY"),
  treatmentNotDecided: z.enum(["ANY", "YES", "NO"]).default("ANY"),
  nactStatus: z.enum(["ANY", "NOT_STARTED", "IN_PROGRESS", "COMPLETED"]).default("ANY"),
  clipsBreast: z.enum(["ANY", "YES", "NO"]).default("ANY"),
  clipsAxilla: z.enum(["ANY", "YES", "NO"]).default("ANY"),
  tumorGrowingOnChemo: z.enum(["ANY", "YES", "NO"]).default("ANY"),
  unableToCompleteChemo: z.enum(["ANY", "YES", "NO"]).default("ANY"),
  chemoStartedClipsMissing: z.enum(["ANY", "YES", "NO"]).default("ANY"),
  radiationBooked: z.enum(["ANY", "YES", "NO", "MISSED", "CANCELLED"]).default("ANY"),
  surgeryAdmission: z.enum(["ANY", "YES", "NO", "MISSED", "CANCELLED"]).default("ANY"),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(20),
  sortBy: z
    .enum(["name_asc", "name_desc", "most_issues", "latest_activity"])
    .default("name_asc"),
});

export type AdvancedAnalysisFilter = z.infer<typeof AdvancedAnalysisFilterSchema>;

// -----------------------------------------------------------------------
// Result interfaces
// -----------------------------------------------------------------------

export interface InvestigationData {
  ordered: boolean;
  appointmentStatus: "NONE" | "SCHEDULED" | "COMPLETED" | "MISSED" | "CANCELLED";
  appointmentDate: string | null;
  testDone: boolean;
  reportCollected: boolean;
  problemFlagged: boolean;
}

export interface PatientAnalysisRow {
  patientId: string;
  name: string;
  uhid: string;
  age: number;
  sex: string;
  currentStage: "REGISTERED" | "INVESTIGATIONS" | "TREATMENT_PLANNED" | "NACT" | "SURGERY";
  investigations: Record<string, InvestigationData>;
  treatmentPlan: {
    nact: boolean;
    surgeryType: "BCS" | "MASTECTOMY" | null;
    radiotherapy: boolean;
    notDecidedYet: boolean;
  };
  nact: {
    status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
    startDate: string | null;
    lastCycleDate: string | null;
    clipsBreast: boolean;
    clipsAxilla: boolean;
    tumorGrowing: boolean;
    unableToComplete: boolean;
    chemoStartedClipsMissing: boolean;
  };
  surgery: {
    admissionDate: string | null;
    admissionStatus: string | null;
    radiationDate: string | null;
    radiationStatus: string | null;
  };
  issues: Array<"MISSED_APPT" | "NO_REPORT" | "CHEMO_ISSUE" | "CLIPS_MISSING" | "NO_PLAN">;
  issueCount: number;
  lastActivityDate: string;
}
