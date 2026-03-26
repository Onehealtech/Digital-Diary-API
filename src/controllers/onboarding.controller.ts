import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { Patient } from "../models/Patient";
import { AppError } from "../utils/AppError";

const MAX_ONBOARDING_VIEWS = 5;

/**
 * GET /api/v1/patient/onboarding-status
 * Returns whether the onboarding instructions should be shown
 * and the current view count.
 */
export const getOnboardingStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const patientId = req.user?.id;
    if (!patientId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const patient = await Patient.findOne({
      where: { id: patientId },
      attributes: ["id", "onboardingViewCount"],
    });

    if (!patient) {
      res.status(404).json({ success: false, message: "Patient not found" });
      return;
    }

    const viewCount = patient.onboardingViewCount ?? 0;

    res.status(200).json({
      success: true,
      message: "Onboarding status fetched",
      data: {
        showOnboarding: viewCount < MAX_ONBOARDING_VIEWS,
        viewCount,
        maxViews: MAX_ONBOARDING_VIEWS,
        remainingViews: Math.max(0, MAX_ONBOARDING_VIEWS - viewCount),
      },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "Failed to fetch onboarding status";
    res.status(500).json({ success: false, message });
  }
};

/**
 * POST /api/v1/patient/onboarding-viewed
 * Increments the onboarding view count by 1 (up to max).
 * Call this each time the patient sees the onboarding screen.
 */
export const recordOnboardingView = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const patientId = req.user?.id;
    if (!patientId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const patient = await Patient.findOne({
      where: { id: patientId },
      attributes: ["id", "onboardingViewCount"],
    });

    if (!patient) {
      res.status(404).json({ success: false, message: "Patient not found" });
      return;
    }

    const currentCount = patient.onboardingViewCount ?? 0;

    if (currentCount >= MAX_ONBOARDING_VIEWS) {
      res.status(200).json({
        success: true,
        message: "Onboarding already completed",
        data: {
          showOnboarding: false,
          viewCount: currentCount,
          maxViews: MAX_ONBOARDING_VIEWS,
          remainingViews: 0,
        },
      });
      return;
    }

    const newCount = currentCount + 1;
    await patient.update({ onboardingViewCount: newCount });

    res.status(200).json({
      success: true,
      message: "Onboarding view recorded",
      data: {
        showOnboarding: newCount < MAX_ONBOARDING_VIEWS,
        viewCount: newCount,
        maxViews: MAX_ONBOARDING_VIEWS,
        remainingViews: Math.max(0, MAX_ONBOARDING_VIEWS - newCount),
      },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ success: false, message: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : "Failed to record onboarding view";
    res.status(500).json({ success: false, message });
  }
};
