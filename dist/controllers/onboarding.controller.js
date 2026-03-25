"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordOnboardingView = exports.getOnboardingStatus = void 0;
const Patient_1 = require("../models/Patient");
const AppError_1 = require("../utils/AppError");
const translations_1 = require("../utils/translations");
const MAX_ONBOARDING_VIEWS = 5;
/**
 * GET /api/v1/patient/onboarding-status
 * Returns whether the onboarding instructions should be shown
 * and the current view count.
 */
const getOnboardingStatus = async (req, res) => {
    try {
        const patientId = req.user?.id;
        if (!patientId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const patient = await Patient_1.Patient.findOne({
            where: { id: patientId },
            attributes: ["id", "onboardingViewCount"],
        });
        if (!patient) {
            res.status(404).json({ success: false, message: "Patient not found" });
            return;
        }
        const viewCount = patient.onboardingViewCount ?? 0;
        const lang = await (0, translations_1.getPatientLanguage)(patientId);
        res.status(200).json({
            success: true,
            message: (0, translations_1.t)("msg.onboardingStatus", lang),
            data: {
                showOnboarding: viewCount < MAX_ONBOARDING_VIEWS,
                viewCount,
                maxViews: MAX_ONBOARDING_VIEWS,
                remainingViews: Math.max(0, MAX_ONBOARDING_VIEWS - viewCount),
            },
        });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        const message = error instanceof Error ? error.message : "Failed to fetch onboarding status";
        res.status(500).json({ success: false, message });
    }
};
exports.getOnboardingStatus = getOnboardingStatus;
/**
 * POST /api/v1/patient/onboarding-viewed
 * Increments the onboarding view count by 1 (up to max).
 * Call this each time the patient sees the onboarding screen.
 */
const recordOnboardingView = async (req, res) => {
    try {
        const patientId = req.user?.id;
        if (!patientId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const patient = await Patient_1.Patient.findOne({
            where: { id: patientId },
            attributes: ["id", "onboardingViewCount"],
        });
        if (!patient) {
            res.status(404).json({ success: false, message: "Patient not found" });
            return;
        }
        const currentCount = patient.onboardingViewCount ?? 0;
        const lang = await (0, translations_1.getPatientLanguage)(patientId);
        // Already reached max — no need to increment
        if (currentCount >= MAX_ONBOARDING_VIEWS) {
            res.status(200).json({
                success: true,
                message: (0, translations_1.t)("msg.onboardingCompleted", lang),
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
            message: (0, translations_1.t)("msg.onboardingViewed", lang),
            data: {
                showOnboarding: newCount < MAX_ONBOARDING_VIEWS,
                viewCount: newCount,
                maxViews: MAX_ONBOARDING_VIEWS,
                remainingViews: Math.max(0, MAX_ONBOARDING_VIEWS - newCount),
            },
        });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        const message = error instanceof Error ? error.message : "Failed to record onboarding view";
        res.status(500).json({ success: false, message });
    }
};
exports.recordOnboardingView = recordOnboardingView;
