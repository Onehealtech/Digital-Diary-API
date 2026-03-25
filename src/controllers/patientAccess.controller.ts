// src/controllers/patientAccess.controller.ts

import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { responseMiddleware } from "../utils/response";
import { HTTP_STATUS } from "../utils/constants";
import { AppError } from "../utils/AppError";
import * as patientAccessService from "../service/patientAccess.service";
import {
  t, getPatientLanguage, translateStatus, translateCaseType,
  translateFields, translateArrayFields,
} from "../utils/translations";

/**
 * GET /api/v1/patient/access-info
 * Returns the patient's access level, diary module, features, and validity.
 * Used by the mobile app to render correct UI based on all_access vs limited_access.
 */
export const getAccessInfo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const patientId = (req.user as { id: string }).id;
    const lang = await getPatientLanguage(patientId);
    const result = await patientAccessService.getPatientAccessInfo(patientId);

    // Add static translated labels
    const data: any = { ...result };
    data.patient = {
      ...data.patient,
      statusLabel: translateStatus(data.patient.status, lang),
      caseTypeLabel: data.patient.caseType ? translateCaseType(data.patient.caseType, lang) : null,
    };

    // Translate dynamic text fields for Hindi
    if (lang === "hi") {
      const translated = await translateFields(data, [
        "patient.fullName",
        "doctor.fullName",
        "doctor.specialization",
        "doctor.hospital",
        "diaryModule.moduleName",
        "subscription.planName",
      ], lang);
      Object.assign(data, translated);
    }

    responseMiddleware(res, HTTP_STATUS.OK, t("msg.accessInfoFetched", lang), data);
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
    const patientId = (req.user as { id: string }).id;
    const lang = await getPatientLanguage(patientId);
    const result = patientAccessService.getDiaryModuleCatalog();

    let data: any = { ...result };

    // Translate module and bundle names for Hindi
    if (lang === "hi") {
      data.modules = await translateArrayFields(data.modules, ["moduleName"], lang);
      data.bundles = await translateArrayFields(data.bundles, ["bundleName"], lang);
    }

    responseMiddleware(res, HTTP_STATUS.OK, t("msg.catalogFetched", lang), data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch catalog";
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, message);
  }
};
