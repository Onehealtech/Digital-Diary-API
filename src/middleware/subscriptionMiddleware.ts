// src/middleware/subscriptionMiddleware.ts

import { Response, NextFunction } from "express";
import { CustomRequest } from "./authMiddleware";
import { responseMiddleware } from "../utils/response";
import { HTTP_STATUS } from "../utils/constants";
import {
  canAddDiaryPage,
  isScanEnabled,
  isManualEntryEnabled,
} from "../service/subscription.service";

/**
 * Middleware to enforce diary page limit based on subscription plan.
 * Attach after patientAuthCheck to have req.user.id available.
 */
export const enforcePageLimit = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const patientId = req.user?.id;
    if (!patientId) {
      responseMiddleware(res, HTTP_STATUS.UNAUTHORIZED, "Patient not authenticated");
      return;
    }

    const check = await canAddDiaryPage(patientId);
    if (!check.allowed) {
      responseMiddleware(res, HTTP_STATUS.FORBIDDEN, check.reason || "Page limit exceeded");
      return;
    }

    next();
  } catch (error) {
    console.error("Page limit check error:", error);
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to verify page limit");
  }
};

/**
 * Middleware to enforce scan feature access based on subscription plan.
 */
export const requireScanEnabled = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const patientId = req.user?.id;
    if (!patientId) {
      responseMiddleware(res, HTTP_STATUS.UNAUTHORIZED, "Patient not authenticated");
      return;
    }

    const enabled = await isScanEnabled(patientId);
    if (!enabled) {
      responseMiddleware(
        res,
        HTTP_STATUS.FORBIDDEN,
        "Scan feature is not available on your current plan. Please upgrade to access this feature."
      );
      return;
    }

    next();
  } catch (error) {
    console.error("Scan access check error:", error);
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to verify scan access");
  }
};

/**
 * Middleware to enforce manual entry access based on subscription plan.
 */
export const requireManualEntryEnabled = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const patientId = req.user?.id;
    if (!patientId) {
      responseMiddleware(res, HTTP_STATUS.UNAUTHORIZED, "Patient not authenticated");
      return;
    }

    const enabled = await isManualEntryEnabled(patientId);
    if (!enabled) {
      responseMiddleware(
        res,
        HTTP_STATUS.FORBIDDEN,
        "Manual entry is not available on your current plan. Please upgrade to access this feature."
      );
      return;
    }

    next();
  } catch (error) {
    console.error("Manual entry access check error:", error);
    responseMiddleware(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Failed to verify manual entry access");
  }
};
