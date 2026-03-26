// src/middleware/translateResponse.middleware.ts
//
// Intercepts JSON responses for patient routes and auto-translates
// all string fields when the patient's language is "hi".
// Names (fullName) are transliterated (phonetic), everything else is translated.

import { Request, Response, NextFunction } from "express";
import {
  SupportedLanguage,
  translateStatus,
  translateCaseType,
  translateReminderType,
  translateReminderStatus,
  t,
  translateBatch,
  transliterateBatch,
} from "../utils/translations";

// ── Fields config ─────────────────────────────────────────────────
// Fields that are proper names → transliterate (phonetic script conversion)
const NAME_FIELDS = new Set(["fullName", "doctorName", "assistantName", "senderName"]);

// Fields that should never be touched (IDs, dates, enums, technical)
const SKIP_FIELDS = new Set([
  "id", "patientId", "doctorId", "vendorId", "diaryId", "senderId",
  "recipientId", "parentId", "relatedTaskId", "relatedTestName",
  "responseId", "requestId", "subscriptionId", "planId", "bundleCode",
  "createdAt", "updatedAt", "deletedAt", "readAt", "respondedAt",
  "reminderDate", "activationDate", "startDate", "endDate",
  "assignedAt", "unassignedAt", "deactivatedAt", "lastDiaryScan",
  "lastDoctorContact", "registeredDate",
  "token", "fcmToken", "sessionId", "actionUrl", "phone", "email",
  "type", "role", "status", "caseType", "severity", "deliveryMethod",
  "recipientType", "registrationSource", "assistantStatus",
  "language", "diaryType", "accessLevel", "gender",
  "otp", "password", "license",
  "success", "isExistingUser", "isNewUser", "read", "isResponded",
  "delivered", "deactivationReason",
]);

// Static enum fields that use the translations.ts dictionary
const ENUM_TRANSLATORS: Record<string, (val: string, lang: SupportedLanguage) => string> = {
  status: translateStatus,
  caseType: translateCaseType,
  reminderType: translateReminderType,
  reminderStatus: translateReminderStatus,
};

// ── Collector: walks the response object and gathers strings to translate ──

interface TranslateJob {
  obj: any;
  key: string;
  type: "translate" | "transliterate";
}

function collectStrings(data: any, jobs: TranslateJob[]): void {
  if (data === null || data === undefined) return;

  if (Array.isArray(data)) {
    for (const item of data) {
      collectStrings(item, jobs);
    }
    return;
  }

  if (typeof data === "object") {
    for (const key of Object.keys(data)) {
      const val = data[key];

      // Skip non-translatable fields
      if (SKIP_FIELDS.has(key)) continue;

      // Handle static enum translations inline (no API call needed)
      if (ENUM_TRANSLATORS[key] && typeof val === "string") {
        // Will be handled in the applyStaticTranslations pass
        continue;
      }

      if (typeof val === "string" && val.trim()) {
        // Booleans-as-strings, UUIDs, URLs, numbers, dates — skip
        if (looksLikeNonText(val)) continue;

        if (NAME_FIELDS.has(key)) {
          jobs.push({ obj: data, key, type: "transliterate" });
        } else {
          jobs.push({ obj: data, key, type: "translate" });
        }
      } else if (typeof val === "object") {
        collectStrings(val, jobs);
      }
    }
  }
}

function looksLikeNonText(val: string): boolean {
  // UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) return true;
  // ISO date
  if (/^\d{4}-\d{2}-\d{2}T/.test(val)) return true;
  // Pure number
  if (/^[\d.]+$/.test(val)) return true;
  // URL
  if (/^https?:\/\//.test(val)) return true;
  // Phone
  if (/^\+?\d[\d\s()-]{6,}$/.test(val)) return true;
  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return true;
  return false;
}

// ── Apply static enum translations (no API call) ───────────────────

function applyStaticTranslations(data: any, lang: SupportedLanguage): void {
  if (data === null || data === undefined) return;

  if (Array.isArray(data)) {
    for (const item of data) applyStaticTranslations(item, lang);
    return;
  }

  if (typeof data === "object") {
    for (const key of Object.keys(data)) {
      const val = data[key];

      // Add translated label for enum fields
      if (ENUM_TRANSLATORS[key] && typeof val === "string") {
        data[`${key}Label`] = ENUM_TRANSLATORS[key](val, lang);
      }

      // Add gender label
      if (key === "gender" && typeof val === "string") {
        data.genderLabel = t(`gender.${val}`, lang);
      }

      // Recurse into nested objects/arrays
      if (typeof val === "object" && val !== null) {
        applyStaticTranslations(val, lang);
      }
    }
  }
}

// ── The middleware ──────────────────────────────────────────────────

export function translateResponse() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only process for authenticated patients with language info
    const user = (req as any).user;
    const lang: SupportedLanguage = user?.language || "en";

    if (lang === "en") {
      next();
      return;
    }

    // Monkey-patch res.json to intercept the response
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      // Only process successful responses with data
      if (!body || !body.success || !body.data) {
        // Translate the message field for error/status responses
        if (body?.message) {
          const msgKey = findMessageKey(body.message);
          if (msgKey) body.message = t(msgKey, lang);
        }
        return originalJson(body);
      }

      // Translate the response message
      if (body.message) {
        const msgKey = findMessageKey(body.message);
        if (msgKey) body.message = t(msgKey, lang);
      }

      // Apply static enum translations (synchronous, no API call)
      applyStaticTranslations(body.data, lang);

      // Collect dynamic strings that need API translation/transliteration
      const jobs: TranslateJob[] = [];
      collectStrings(body.data, jobs);

      if (jobs.length === 0) {
        return originalJson(body);
      }

      // Separate into translate vs transliterate batches
      const translateJobs = jobs.filter((j) => j.type === "translate");
      const transliterateJobs = jobs.filter((j) => j.type === "transliterate");

      const translateTexts = translateJobs.map((j) => j.obj[j.key]);
      const transliterateTexts = transliterateJobs.map((j) => j.obj[j.key]);

      // Run both batches in parallel
      Promise.all([
        translateTexts.length > 0 ? translateBatch(translateTexts, lang) : [],
        transliterateTexts.length > 0 ? transliterateBatch(transliterateTexts, lang) : [],
      ])
        .then(([translated, transliterated]) => {
          // Apply translated values back to the response object
          translateJobs.forEach((job, i) => {
            job.obj[job.key] = translated[i];
          });
          transliterateJobs.forEach((job, i) => {
            job.obj[job.key] = transliterated[i];
          });

          return originalJson(body);
        })
        .catch((err) => {
          console.error("Translation middleware error:", err);
          // On failure, send untranslated response
          return originalJson(body);
        });
    } as any;

    next();
  };
}

// ── Reverse-lookup for response message keys ────────────────────────

const MESSAGE_TO_KEY: Record<string, string> = {
  "Profile updated successfully": "msg.profileUpdated",
  "Profile retrieved successfully": "msg.profileRetrieved",
  "OTP sent to your registered mobile number": "msg.otpSent",
  "Reminders retrieved successfully": "msg.remindersRetrieved",
  "Reminder marked as read": "msg.reminderMarkedRead",
  "Reminder accepted successfully": "msg.reminderAccepted",
  "Reminder rejected successfully": "msg.reminderRejected",
  "Onboarding status fetched": "msg.onboardingStatus",
  "Onboarding already completed": "msg.onboardingCompleted",
  "Onboarding view recorded": "msg.onboardingViewed",
  "Access info fetched successfully": "msg.accessInfoFetched",
  "Diary catalog fetched successfully": "msg.catalogFetched",
  "Notifications retrieved": "msg.notificationsRetrieved",
  "Notification marked as read": "msg.notificationMarkedRead",
  "All notifications marked as read": "msg.allNotificationsRead",
  "Patient not found": "msg.patientNotFound",
  "Unauthorized": "msg.unauthorized",
  "Reminder not found": "msg.reminderNotFound",
  "Cannot respond to this reminder anymore": "msg.cannotRespondReminder",
};

function findMessageKey(message: string): string | null {
  return MESSAGE_TO_KEY[message] || null;
}
