// src/controllers/patientAccess.controller.ts

import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { responseMiddleware } from "../utils/response";
import { HTTP_STATUS } from "../utils/constants";
import { AppError } from "../utils/AppError";
import * as patientAccessService from "../service/patientAccess.service";

/**
 * GET /api/v1/patient/access-info
 * Returns the patient's access level, diary module, features, and validity.
 * Used by the mobile app to render correct UI based on all_access vs limited_access.
 */
export const getAccessInfo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const patientId = (req.user as { id: string }).id;
    const result = await patientAccessService.getPatientAccessInfo(patientId);
    responseMiddleware(res, HTTP_STATUS.OK, "Access info fetched successfully", result);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      responseMiddleware(res, error.statusCode, error.message);
      return;
    }
    const message = error instanceof Error ? error.message : "Failed to fetch access info";
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
};

/**
 * GET /api/v1/patient/diary-catalog
 * Returns all available diary modules and bundle packs with pricing.
 * Public-facing for the store/catalog screen.
 */
export const getDiaryCatalog = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = patientAccessService.getDiaryModuleCatalog();
    responseMiddleware(res, HTTP_STATUS.OK, "Diary catalog fetched successfully", result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch catalog";
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
};
