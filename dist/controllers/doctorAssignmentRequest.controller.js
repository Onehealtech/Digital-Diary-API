"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectRequest = exports.acceptRequest = exports.getRequests = exports.getMyRequests = exports.createRequest = void 0;
const zod_1 = require("zod");
const AppError_1 = require("../utils/AppError");
const constants_1 = require("../utils/constants");
const response_1 = require("../utils/response");
const activityLogger_1 = require("../utils/activityLogger");
const requestService = __importStar(require("../service/doctorAssignmentRequest.service"));
// ── Zod Schemas ──────────────────────────────────────────────────────────
const createRequestSchema = zod_1.z.object({
    doctorId: zod_1.z.string().uuid("Invalid doctor ID"),
});
const rejectRequestSchema = zod_1.z.object({
    rejectionReason: zod_1.z.string().max(500).optional(),
});
// ── Patient-facing endpoints (called from mobile app) ────────────────────
/**
 * POST /api/v1/doctor-requests
 * Patient sends a request to a doctor (max 2 per doctor)
 */
const createRequest = async (req, res) => {
    try {
        const patientId = req.user ? req.user.id : null;
        const { doctorId } = req.body;
        const request = await requestService.createRequest(patientId, doctorId);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.CREATED, "Request sent to doctor successfully", request);
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        const message = error instanceof Error ? error.message : "Failed to create request";
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
exports.createRequest = createRequest;
/**
 * GET /api/v1/doctor-requests/my-requests
 * Patient views their own requests
 */
const getMyRequests = async (req, res) => {
    try {
        const patientId = req.user ? req.user.id : null;
        const requests = await requestService.getRequestsForPatient(patientId);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Requests fetched", requests);
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch requests");
    }
};
exports.getMyRequests = getMyRequests;
// ── Doctor-facing endpoints (called from web dashboard) ──────────────────
/**
 * GET /api/v1/doctor-requests
 * Doctor views assignment requests (optionally filtered by status)
 */
const getRequests = async (req, res) => {
    try {
        const doctorId = req.user.id;
        const status = req.query.status;
        const requests = await requestService.getRequestsForDoctor(doctorId, status);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Requests fetched", requests);
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch requests");
    }
};
exports.getRequests = getRequests;
/**
 * PUT /api/v1/doctor-requests/:id/accept
 * Doctor accepts a patient request
 */
const acceptRequest = async (req, res) => {
    try {
        const doctorId = req.user.id;
        const requestId = req.params.id;
        const result = await requestService.acceptRequest(requestId, doctorId);
        (0, activityLogger_1.logActivity)({
            req,
            userId: doctorId,
            userRole: "DOCTOR",
            action: "PATIENT_REQUEST_ACCEPTED",
            details: { requestId, patientId: result.patientId },
        });
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Patient request accepted", result);
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to accept request");
    }
};
exports.acceptRequest = acceptRequest;
/**
 * PUT /api/v1/doctor-requests/:id/reject
 * Doctor rejects a patient request
 */
const rejectRequest = async (req, res) => {
    try {
        const doctorId = req.user.id;
        const requestId = req.params.id;
        const parsed = rejectRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
            return;
        }
        const result = await requestService.rejectRequest(requestId, doctorId, parsed.data.rejectionReason);
        (0, activityLogger_1.logActivity)({
            req,
            userId: doctorId,
            userRole: "DOCTOR",
            action: "PATIENT_REQUEST_REJECTED",
            details: { requestId, patientId: result.patientId, reason: parsed.data.rejectionReason },
        });
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Patient request rejected", result);
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to reject request");
    }
};
exports.rejectRequest = rejectRequest;
