"use strict";
// src/controllers/patientDoctorSuggestion.controller.ts
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
exports.rejectSuggestion = exports.approveSuggestion = exports.getSuggestionById = exports.getAllSuggestions = exports.getMySuggestions = exports.createSuggestion = void 0;
const zod_1 = require("zod");
const response_1 = require("../utils/response");
const constants_1 = require("../utils/constants");
const AppError_1 = require("../utils/AppError");
const activityLogger_1 = require("../utils/activityLogger");
const suggestionService = __importStar(require("../service/patientDoctorSuggestion.service"));
// ── Zod Schemas ──────────────────────────────────────────────────────────
const createSuggestionSchema = zod_1.z.object({
    doctorName: zod_1.z.string().min(2, "Doctor name is required").max(255),
    doctorPhone: zod_1.z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits").optional(),
    doctorEmail: zod_1.z.string().email("Invalid email").optional(),
    hospital: zod_1.z.string().max(255).optional(),
    specialization: zod_1.z.string().max(255).optional(),
    city: zod_1.z.string().max(255).optional(),
    additionalNotes: zod_1.z.string().max(1000).optional(),
});
const approveSuggestionSchema = zod_1.z.object({
    onboardedDoctorId: zod_1.z.string().uuid("Invalid doctor ID").optional(),
    newDoctor: zod_1.z.object({
        fullName: zod_1.z.string().min(1, "Doctor name is required").max(100),
        email: zod_1.z.string().email("Invalid email"),
        phone: zod_1.z.string().regex(/^\d{10}$/, "Phone must be exactly 10 digits").optional(),
        hospital: zod_1.z.string().max(100).optional(),
        specialization: zod_1.z.string().max(100).optional(),
        license: zod_1.z.string().max(30).optional(),
        address: zod_1.z.string().max(500).optional(),
        city: zod_1.z.string().max(100).optional(),
        state: zod_1.z.string().max(100).optional(),
    }).optional(),
});
const rejectSuggestionSchema = zod_1.z.object({
    rejectionReason: zod_1.z.string().max(500).optional(),
});
// ── Patient-facing endpoints ─────────────────────────────────────────────
/**
 * POST /api/v1/doctor-requests/suggest-doctor
 * Patient suggests a doctor not found in the system
 */
const createSuggestion = async (req, res) => {
    try {
        const patientId = req.user.id;
        const parsed = createSuggestionSchema.safeParse(req.body);
        if (!parsed.success) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
            return;
        }
        const result = await suggestionService.createSuggestion(patientId, parsed.data);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.CREATED, "Doctor suggestion submitted successfully", result);
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        const message = error instanceof Error ? error.message : "Failed to submit suggestion";
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
exports.createSuggestion = createSuggestion;
/**
 * GET /api/v1/doctor-requests/my-suggestions
 * Patient views their own suggestions
 */
const getMySuggestions = async (req, res) => {
    try {
        const patientId = req.user.id;
        const suggestions = await suggestionService.getMySuggestions(patientId);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Suggestions fetched", suggestions);
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch suggestions");
    }
};
exports.getMySuggestions = getMySuggestions;
// ── Super Admin-facing endpoints ─────────────────────────────────────────
/**
 * GET /api/v1/doctor-requests/suggestions
 * Super Admin views all doctor suggestions with pagination
 */
const getAllSuggestions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const result = await suggestionService.getAllSuggestions({ page, limit, status });
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Suggestions fetched", result);
    }
    catch (error) {
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch suggestions");
    }
};
exports.getAllSuggestions = getAllSuggestions;
/**
 * GET /api/v1/doctor-requests/suggestions/:id
 * Super Admin views single suggestion detail
 */
const getSuggestionById = async (req, res) => {
    try {
        const result = await suggestionService.getSuggestionById(req.params.id);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Suggestion fetched", result);
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to fetch suggestion");
    }
};
exports.getSuggestionById = getSuggestionById;
/**
 * POST /api/v1/doctor-requests/suggestions/:id/approve
 * Super Admin approves a patient doctor suggestion
 */
const approveSuggestion = async (req, res) => {
    try {
        const parsed = approveSuggestionSchema.safeParse(req.body);
        if (!parsed.success) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
            return;
        }
        const result = await suggestionService.approveSuggestion(req.params.id, req.user.id, parsed.data.onboardedDoctorId, parsed.data.newDoctor);
        const message = result.doctorCreated
            ? "Doctor suggestion approved and new doctor profile created"
            : "Doctor suggestion approved";
        (0, activityLogger_1.logActivity)({
            req,
            userId: req.user.id,
            userRole: "SUPER_ADMIN",
            action: "DOCTOR_SUGGESTION_APPROVED",
            details: {
                suggestionId: req.params.id,
                onboardedDoctorId: result.suggestion.onboardedDoctorId,
                doctorCreated: result.doctorCreated,
            },
        });
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, message, result);
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to approve suggestion");
    }
};
exports.approveSuggestion = approveSuggestion;
/**
 * POST /api/v1/doctor-requests/suggestions/:id/reject
 * Super Admin rejects a patient doctor suggestion
 */
const rejectSuggestion = async (req, res) => {
    try {
        const parsed = rejectSuggestionSchema.safeParse(req.body);
        if (!parsed.success) {
            (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0].message);
            return;
        }
        const result = await suggestionService.rejectSuggestion(req.params.id, req.user.id, parsed.data.rejectionReason);
        (0, activityLogger_1.logActivity)({
            req,
            userId: req.user.id,
            userRole: "SUPER_ADMIN",
            action: "DOCTOR_SUGGESTION_REJECTED",
            details: { suggestionId: req.params.id, reason: parsed.data.rejectionReason },
        });
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Doctor suggestion rejected", result);
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to reject suggestion");
    }
};
exports.rejectSuggestion = rejectSuggestion;
