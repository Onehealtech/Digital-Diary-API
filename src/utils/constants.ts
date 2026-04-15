/**
 * User Roles
 * Defines the allowed roles in the system
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  VENDOR = 'VENDOR',
  DOCTOR = 'DOCTOR',
  ASSISTANT = 'ASSISTANT',
  PATIENT = 'PATIENT',
}

/**
 * API Response Messages
 * Standardized messages for API responses
 */
export const API_MESSAGES = {
  // Success messages
  LOGIN_SUCCESS: 'User logged in successfully',
  REGISTER_SUCCESS: 'User registered successfully',

  // Error messages
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_NOT_FOUND: 'User not found',
  USER_ALREADY_EXISTS: 'User with this email already exists',
  MISSING_FIELDS: 'Required fields are missing',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'You do not have permission to perform this action',
  INVALID_ROLE: 'Role must be one of: SUPER_ADMIN, VENDOR, DOCTOR, ASSISTANT',

  // Server errors
  SERVER_ERROR: 'Internal server error',
};

/**
 * HTTP Status Codes
 * Standard HTTP response status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVER_ERROR: 500,
  INTERNAL_SERVER_ERROR: 500,
};

/**
 * GCP Configuration
 * Google Cloud Platform bucket and project settings
 */
export const GCP_BUCKET_NAME = 'oneheal-document-uploads';
export const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'your-gcp-project-id';

/**
 * Patient Case Types
 * Each case type maps to a specific diary type with its own questions/pages
 */
export enum CaseType {
  PERI_OPERATIVE = "PERI_OPERATIVE",
  POST_OPERATIVE = "POST_OPERATIVE",
  FOLLOW_UP = "FOLLOW_UP",
  CHEMOTHERAPY = "CHEMOTHERAPY",
  RADIOLOGY = "RADIOLOGY",
}

/**
 * CaseType → DiaryType mapping
 * Each caseType maps to a diaryType string that matches the `diaryType` column in diary_pages table.
 * Update the values here when new diary types are seeded.
 */
export const CASE_TYPE_TO_DIARY_TYPE: Record<CaseType, string> = {
  [CaseType.PERI_OPERATIVE]: "CanTRAC-Breast",
  [CaseType.POST_OPERATIVE]: "CanTRAC-PostOp",
  [CaseType.FOLLOW_UP]: "CanTRAC-FollowUp",
  [CaseType.CHEMOTHERAPY]: "CanTRAC-Chemo",
  [CaseType.RADIOLOGY]: "CanTRAC-Radiology",
};

/**
 * Default diary type for backward compatibility (patients without caseType)
 */
export const DEFAULT_DIARY_TYPE = "CanTRAC-Breast";

/**
 * Resolve a patient's caseType to its corresponding diaryType.
 * Falls back to DEFAULT_DIARY_TYPE when caseType is null/undefined.
 */
export function getDiaryTypeForCaseType(caseType?: string | null): string {
  if (caseType && caseType in CASE_TYPE_TO_DIARY_TYPE) {
    return CASE_TYPE_TO_DIARY_TYPE[caseType as CaseType];
  }
  return DEFAULT_DIARY_TYPE;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCESS LEVELS
// ═══════════════════════════════════════════════════════════════════════════

export enum AccessLevel {
  ALL_ACCESS = "all_access",
  LIMITED_ACCESS = "limited_access",
}

// ═══════════════════════════════════════════════════════════════════════════
// DIARY MODULE PRICING & VALIDITY (from Elvantra Pricing v1, 18 Mar 2026)
// ═══════════════════════════════════════════════════════════════════════════

export interface DiaryModuleConfig {
  caseType: CaseType;
  moduleName: string;
  diaryType: string;
  defaultValidityDays: number;
  mrpInclGST: number;
  extensions: { label: string; days: number; price: number }[];
}

export const DIARY_MODULES: Record<CaseType, DiaryModuleConfig> = {
  [CaseType.PERI_OPERATIVE]: {
    caseType: CaseType.PERI_OPERATIVE,
    moduleName: "Peri-Operative Diary",
    diaryType: "CanTRAC-Breast",
    defaultValidityDays: 30,
    mrpInclGST: 2499,
    extensions: [
      { label: "+15 days", days: 15, price: 799 },
      { label: "+30 days", days: 30, price: 1199 },
    ],
  },
  [CaseType.POST_OPERATIVE]: {
    caseType: CaseType.POST_OPERATIVE,
    moduleName: "Post-Operative Diary",
    diaryType: "CanTRAC-PostOp",
    defaultValidityDays: 30,
    mrpInclGST: 2499,
    extensions: [
      { label: "+15 days", days: 15, price: 799 },
      { label: "+30 days", days: 30, price: 1199 },
    ],
  },
  [CaseType.CHEMOTHERAPY]: {
    caseType: CaseType.CHEMOTHERAPY,
    moduleName: "Chemotherapy Diary",
    diaryType: "CanTRAC-Chemo",
    defaultValidityDays: 90,
    mrpInclGST: 4999,
    extensions: [{ label: "+30 days", days: 30, price: 1499 }],
  },
  [CaseType.RADIOLOGY]: {
    caseType: CaseType.RADIOLOGY,
    moduleName: "Radiation Therapy Diary",
    diaryType: "CanTRAC-Radiology",
    defaultValidityDays: 60,
    mrpInclGST: 3999,
    extensions: [{ label: "+15 days", days: 15, price: 999 }],
  },
  [CaseType.FOLLOW_UP]: {
    caseType: CaseType.FOLLOW_UP,
    moduleName: "Follow-up Diary",
    diaryType: "CanTRAC-FollowUp",
    defaultValidityDays: 365,
    mrpInclGST: 2999,
    extensions: [{ label: "+12 months", days: 365, price: 2499 }],
  },
};

export interface BundleConfig {
  bundleCode: string;
  bundleName: string;
  includes: CaseType[];
  packMRP: number;
  discountPercent: number;
}

export const BUNDLE_PACKS: BundleConfig[] = [
  {
    bundleCode: "SURGERY_PACK",
    bundleName: "Surgery Pack",
    includes: [CaseType.PERI_OPERATIVE, CaseType.POST_OPERATIVE],
    packMRP: 4499,
    discountPercent: 10,
  },
  {
    bundleCode: "TREATMENT_PACK",
    bundleName: "Treatment Pack",
    includes: [CaseType.PERI_OPERATIVE, CaseType.POST_OPERATIVE, CaseType.CHEMOTHERAPY],
    packMRP: 8499,
    discountPercent: 15,
  },
  {
    bundleCode: "COMPLETE_CARE_PACK",
    bundleName: "Complete Care Pack",
    includes: [
      CaseType.PERI_OPERATIVE,
      CaseType.POST_OPERATIVE,
      CaseType.CHEMOTHERAPY,
      CaseType.RADIOLOGY,
      CaseType.FOLLOW_UP,
    ],
    packMRP: 14499,
    discountPercent: 20,
  },
];