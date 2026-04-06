import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "./authMiddleware";
import {
  assertApprovedDiaryAccess,
  DIARY_ACCESS_REQUIRED_MESSAGE,
} from "../service/diaryAccess.service";
import { AppError } from "../utils/AppError";

/**
 * Blocks patient diary APIs until Super Admin approves the sold diary.
 * Required because JWT auth alone cannot enforce business-level approval state.
 */
export const requireApprovedDiary = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const patientId = req.user?.id as string | undefined;
    if (!patientId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    await assertApprovedDiaryAccess(patientId);

    next();
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message || DIARY_ACCESS_REQUIRED_MESSAGE,
      });
      return;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[DIARY_ACCESS] approval check failed:", message);
    res.status(500).json({ success: false, message: "Failed to validate diary approval" });
  }
};
