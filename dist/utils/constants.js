"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUNDLE_PACKS = exports.DIARY_MODULES = exports.AccessLevel = exports.getDiaryTypeForCaseType = exports.DEFAULT_DIARY_TYPE = exports.CASE_TYPE_TO_DIARY_TYPE = exports.CaseType = exports.GCP_PROJECT_ID = exports.GCP_BUCKET_NAME = exports.HTTP_STATUS = exports.API_MESSAGES = exports.UserRole = void 0;
/**
 * User Roles
 * Defines the allowed roles in the system
 */
var UserRole;
(function (UserRole) {
    UserRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    UserRole["VENDOR"] = "VENDOR";
    UserRole["DOCTOR"] = "DOCTOR";
    UserRole["ASSISTANT"] = "ASSISTANT";
    UserRole["PATIENT"] = "PATIENT";
})(UserRole = exports.UserRole || (exports.UserRole = {}));
/**
 * API Response Messages
 * Standardized messages for API responses
 */
exports.API_MESSAGES = {
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
exports.HTTP_STATUS = {
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
exports.GCP_BUCKET_NAME = 'oneheal-document-uploads';
exports.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'your-gcp-project-id';
/**
 * Patient Case Types
 * Each case type maps to a specific diary type with its own questions/pages
 */
var CaseType;
(function (CaseType) {
    CaseType["PERI_OPERATIVE"] = "PERI_OPERATIVE";
    CaseType["POST_OPERATIVE"] = "POST_OPERATIVE";
    CaseType["FOLLOW_UP"] = "FOLLOW_UP";
    CaseType["CHEMOTHERAPY"] = "CHEMOTHERAPY";
    CaseType["RADIOLOGY"] = "RADIOLOGY";
})(CaseType = exports.CaseType || (exports.CaseType = {}));
/**
 * CaseType → DiaryType mapping
 * Each caseType maps to a diaryType string that matches the `diaryType` column in diary_pages table.
 * Update the values here when new diary types are seeded.
 */
exports.CASE_TYPE_TO_DIARY_TYPE = {
    [CaseType.PERI_OPERATIVE]: "CANTrac-Breast",
    [CaseType.POST_OPERATIVE]: "CANTrac-PostOp",
    [CaseType.FOLLOW_UP]: "CANTrac-FollowUp",
    [CaseType.CHEMOTHERAPY]: "CANTrac-Chemo",
    [CaseType.RADIOLOGY]: "CANTrac-Radiology",
};
/**
 * Default diary type for backward compatibility (patients without caseType)
 */
exports.DEFAULT_DIARY_TYPE = "CANTrac-Breast";
/**
 * Resolve a patient's caseType to its corresponding diaryType.
 * Falls back to DEFAULT_DIARY_TYPE when caseType is null/undefined.
 */
function getDiaryTypeForCaseType(caseType) {
    if (caseType && caseType in exports.CASE_TYPE_TO_DIARY_TYPE) {
        return exports.CASE_TYPE_TO_DIARY_TYPE[caseType];
    }
    return exports.DEFAULT_DIARY_TYPE;
}
exports.getDiaryTypeForCaseType = getDiaryTypeForCaseType;
// ═══════════════════════════════════════════════════════════════════════════
// ACCESS LEVELS
// ═══════════════════════════════════════════════════════════════════════════
var AccessLevel;
(function (AccessLevel) {
    AccessLevel["ALL_ACCESS"] = "all_access";
    AccessLevel["LIMITED_ACCESS"] = "limited_access";
})(AccessLevel = exports.AccessLevel || (exports.AccessLevel = {}));
exports.DIARY_MODULES = {
    [CaseType.PERI_OPERATIVE]: {
        caseType: CaseType.PERI_OPERATIVE,
        moduleName: "Peri-Operative Diary",
        diaryType: "CANTrac-Breast",
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
        diaryType: "CANTrac-PostOp",
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
        diaryType: "CANTrac-Chemo",
        defaultValidityDays: 90,
        mrpInclGST: 4999,
        extensions: [{ label: "+30 days", days: 30, price: 1499 }],
    },
    [CaseType.RADIOLOGY]: {
        caseType: CaseType.RADIOLOGY,
        moduleName: "Radiation Therapy Diary",
        diaryType: "CANTrac-Radiology",
        defaultValidityDays: 60,
        mrpInclGST: 3999,
        extensions: [{ label: "+15 days", days: 15, price: 999 }],
    },
    [CaseType.FOLLOW_UP]: {
        caseType: CaseType.FOLLOW_UP,
        moduleName: "Follow-up Diary",
        diaryType: "CANTrac-FollowUp",
        defaultValidityDays: 365,
        mrpInclGST: 2999,
        extensions: [{ label: "+12 months", days: 365, price: 2499 }],
    },
};
exports.BUNDLE_PACKS = [
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
