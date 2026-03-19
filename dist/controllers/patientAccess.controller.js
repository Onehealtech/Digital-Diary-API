"use strict";
// src/controllers/patientAccess.controller.ts
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
exports.getDiaryCatalog = exports.getAccessInfo = void 0;
const response_1 = require("../utils/response");
const constants_1 = require("../utils/constants");
const AppError_1 = require("../utils/AppError");
const patientAccessService = __importStar(require("../service/patientAccess.service"));
/**
 * GET /api/v1/patient/access-info
 * Returns the patient's access level, diary module, features, and validity.
 * Used by the mobile app to render correct UI based on all_access vs limited_access.
 */
const getAccessInfo = async (req, res) => {
    try {
        const patientId = req.user.id;
        const result = await patientAccessService.getPatientAccessInfo(patientId);
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Access info fetched successfully", result);
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            (0, response_1.responseMiddleware)(res, error.statusCode, error.message);
            return;
        }
        const message = error instanceof Error ? error.message : "Failed to fetch access info";
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
exports.getAccessInfo = getAccessInfo;
/**
 * GET /api/v1/patient/diary-catalog
 * Returns all available diary modules and bundle packs with pricing.
 * Public-facing for the store/catalog screen.
 */
const getDiaryCatalog = async (req, res) => {
    try {
        const result = patientAccessService.getDiaryModuleCatalog();
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.OK, "Diary catalog fetched successfully", result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch catalog";
        (0, response_1.responseMiddleware)(res, constants_1.HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
    }
};
exports.getDiaryCatalog = getDiaryCatalog;
