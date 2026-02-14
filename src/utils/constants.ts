/**
 * User Roles
 * Defines the allowed roles in the system
 */
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  VENDOR = 'VENDOR',
  DOCTOR = 'DOCTOR',
  ASSISTANT = 'ASSISTANT',
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