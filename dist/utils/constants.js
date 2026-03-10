"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDiaryTypeForCaseType = exports.DEFAULT_DIARY_TYPE = exports.CASE_TYPE_TO_DIARY_TYPE = exports.CaseType = exports.GCP_PROJECT_ID = exports.GCP_BUCKET_NAME = exports.HTTP_STATUS = exports.API_MESSAGES = exports.UserRole = void 0;
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
