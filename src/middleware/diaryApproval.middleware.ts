import { NextFunction, Response } from "express";
import { Patient } from "../models/Patient";
import { Diary } from "../models/Diary";
import { AuthenticatedRequest } from "./authMiddleware";
import { DIARY_STATUS } from "../utils/diaryStatus";

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

    const patient = await Patient.findByPk(patientId, {
      attributes: ["id", "diaryId"],
    });

    if (!patient?.diaryId) {
      console.info(`[DIARY_ACCESS] denied patient=${patientId} reason=no_diary`);
      res.status(403).json({
        success: false,
        message: "Diary not approved by Super Admin",
      });
      return;
    }

    const diary = await Diary.findByPk(patient.diaryId, {
      attributes: ["id", "status"],
    });

    const diaryStatus = (diary as any)?.status;
    console.info(
      `[DIARY_ACCESS] patient=${patientId} diary=${patient.diaryId} status=${diaryStatus ?? "UNKNOWN"}`
    );

    if (!diary || diaryStatus !== DIARY_STATUS.APPROVED) {
      res.status(403).json({
        success: false,
        message: "Diary not approved by Super Admin",
      });
      return;
    }

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[DIARY_ACCESS] approval check failed:", message);
    res.status(500).json({ success: false, message: "Failed to validate diary approval" });
  }
};
