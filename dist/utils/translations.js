"use strict";
/**
 * Patient-facing translations (English + Hindi)
 * Used to translate API response labels when patient language is "hi"
 */
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
exports.getPatientLanguage = exports.translateReminderStatus = exports.translateReminderType = exports.translateCaseType = exports.translateStatus = exports.t = void 0;
const translations = {
    // ── Patient Status ─────────────────────────────────────────────
    "status.ACTIVE": { en: "Active", hi: "सक्रिय" },
    "status.CRITICAL": { en: "Critical", hi: "गंभीर" },
    "status.COMPLETED": { en: "Completed", hi: "पूर्ण" },
    "status.INACTIVE": { en: "Inactive", hi: "निष्क्रिय" },
    "status.ON_HOLD": { en: "On Hold", hi: "रुका हुआ" },
    "status.DOCTOR_REASSIGNED": { en: "Doctor Reassigned", hi: "डॉक्टर पुनः नियुक्त" },
    // ── Case Types ─────────────────────────────────────────────────
    "caseType.PERI_OPERATIVE": { en: "Peri-Operative", hi: "शल्य-पूर्व" },
    "caseType.POST_OPERATIVE": { en: "Post-Operative", hi: "शल्य-पश्चात" },
    "caseType.FOLLOW_UP": { en: "Follow-Up", hi: "अनुवर्ती" },
    "caseType.CHEMOTHERAPY": { en: "Chemotherapy", hi: "कीमोथेरेपी" },
    "caseType.RADIOLOGY": { en: "Radiation Therapy", hi: "विकिरण चिकित्सा" },
    // ── Reminder Types ─────────────────────────────────────────────
    "reminderType.APPOINTMENT": { en: "Appointment", hi: "अपॉइंटमेंट" },
    "reminderType.CHEMOTHERAPY": { en: "Chemotherapy", hi: "कीमोथेरेपी" },
    "reminderType.RADIOLOGY": { en: "Radiology", hi: "विकिरण" },
    "reminderType.FOLLOW_UP": { en: "Follow-Up", hi: "अनुवर्ती" },
    "reminderType.OTHER": { en: "Other", hi: "अन्य" },
    // ── Reminder Status ────────────────────────────────────────────
    "reminderStatus.PENDING": { en: "Pending", hi: "लंबित" },
    "reminderStatus.READ": { en: "Read", hi: "पढ़ा गया" },
    "reminderStatus.EXPIRED": { en: "Expired", hi: "समाप्त" },
    "reminderStatus.ACCEPTED": { en: "Accepted", hi: "स्वीकृत" },
    "reminderStatus.REJECTED": { en: "Rejected", hi: "अस्वीकृत" },
    "reminderStatus.CLOSED": { en: "Closed", hi: "बंद" },
    // ── Notification Types ─────────────────────────────────────────
    "notificationType.reminder": { en: "Reminder", hi: "अनुस्मारक" },
    "notificationType.alert": { en: "Alert", hi: "चेतावनी" },
    "notificationType.info": { en: "Information", hi: "जानकारी" },
    "notificationType.message": { en: "Message", hi: "संदेश" },
    // ── Notification Severity ──────────────────────────────────────
    "severity.low": { en: "Low", hi: "कम" },
    "severity.medium": { en: "Medium", hi: "मध्यम" },
    "severity.high": { en: "High", hi: "उच्च" },
    "severity.critical": { en: "Critical", hi: "गंभीर" },
    // ── API Response Messages (Patient-facing) ─────────────────────
    "msg.profileUpdated": { en: "Profile updated successfully", hi: "प्रोफ़ाइल सफलतापूर्वक अपडेट की गई" },
    "msg.profileRetrieved": { en: "Profile retrieved successfully", hi: "प्रोफ़ाइल सफलतापूर्वक प्राप्त की गई" },
    "msg.otpSent": { en: "OTP sent to your registered mobile number", hi: "ओटीपी आपके पंजीकृत मोबाइल नंबर पर भेजा गया" },
    "msg.remindersRetrieved": { en: "Reminders retrieved successfully", hi: "अनुस्मारक सफलतापूर्वक प्राप्त किए गए" },
    "msg.reminderMarkedRead": { en: "Reminder marked as read", hi: "अनुस्मारक पढ़ा गया के रूप में चिह्नित" },
    "msg.reminderAccepted": { en: "Reminder accepted successfully", hi: "अनुस्मारक सफलतापूर्वक स्वीकृत" },
    "msg.reminderRejected": { en: "Reminder rejected successfully", hi: "अनुस्मारक सफलतापूर्वक अस्वीकृत" },
    "msg.onboardingStatus": { en: "Onboarding status fetched", hi: "ऑनबोर्डिंग स्थिति प्राप्त की गई" },
    "msg.onboardingCompleted": { en: "Onboarding already completed", hi: "ऑनबोर्डिंग पहले से पूर्ण" },
    "msg.onboardingViewed": { en: "Onboarding view recorded", hi: "ऑनबोर्डिंग दृश्य दर्ज किया गया" },
    "msg.accessInfoFetched": { en: "Access info fetched successfully", hi: "एक्सेस जानकारी सफलतापूर्वक प्राप्त की गई" },
    "msg.catalogFetched": { en: "Diary catalog fetched successfully", hi: "डायरी कैटलॉग सफलतापूर्वक प्राप्त की गई" },
    "msg.notificationsRetrieved": { en: "Notifications retrieved", hi: "सूचनाएं प्राप्त की गईं" },
    "msg.notificationMarkedRead": { en: "Notification marked as read", hi: "सूचना पढ़ी गई के रूप में चिह्नित" },
    "msg.allNotificationsRead": { en: "All notifications marked as read", hi: "सभी सूचनाएं पढ़ी गई के रूप में चिह्नित" },
    "msg.patientNotFound": { en: "Patient not found", hi: "रोगी नहीं मिला" },
    "msg.unauthorized": { en: "Unauthorized", hi: "अनधिकृत" },
    "msg.reminderNotFound": { en: "Reminder not found", hi: "अनुस्मारक नहीं मिला" },
    "msg.cannotRespondReminder": { en: "Cannot respond to this reminder anymore", hi: "अब इस अनुस्मारक का जवाब नहीं दे सकते" },
    // ── Gender ─────────────────────────────────────────────────────
    "gender.Male": { en: "Male", hi: "पुरुष" },
    "gender.Female": { en: "Female", hi: "महिला" },
    "gender.Other": { en: "Other", hi: "अन्य" },
    // ── Common Labels ──────────────────────────────────────────────
    "label.doctor": { en: "Doctor", hi: "डॉक्टर" },
    "label.patient": { en: "Patient", hi: "रोगी" },
    "label.diary": { en: "Diary", hi: "डायरी" },
    "label.scan": { en: "Scan", hi: "स्कैन" },
    "label.notifications": { en: "Notifications", hi: "सूचनाएं" },
    "label.reminders": { en: "Reminders", hi: "अनुस्मारक" },
    "label.profile": { en: "Profile", hi: "प्रोफ़ाइल" },
    "label.settings": { en: "Settings", hi: "सेटिंग्स" },
    "label.language": { en: "Language", hi: "भाषा" },
    "label.english": { en: "English", hi: "अंग्रेज़ी" },
    "label.hindi": { en: "Hindi", hi: "हिंदी" },
};
/**
 * Translate a key to the given language.
 * Falls back to English if the key or language is not found.
 */
function t(key, lang = "en") {
    const entry = translations[key];
    if (!entry)
        return key;
    return entry[lang] || entry.en || key;
}
exports.t = t;
/**
 * Translate a status value (e.g., "ACTIVE" → "सक्रिय" for Hindi)
 */
function translateStatus(status, lang = "en") {
    return t(`status.${status}`, lang);
}
exports.translateStatus = translateStatus;
/**
 * Translate a case type value
 */
function translateCaseType(caseType, lang = "en") {
    return t(`caseType.${caseType}`, lang);
}
exports.translateCaseType = translateCaseType;
/**
 * Translate a reminder type
 */
function translateReminderType(type, lang = "en") {
    return t(`reminderType.${type}`, lang);
}
exports.translateReminderType = translateReminderType;
/**
 * Translate a reminder status
 */
function translateReminderStatus(status, lang = "en") {
    return t(`reminderStatus.${status}`, lang);
}
exports.translateReminderStatus = translateReminderStatus;
/**
 * Get patient language from the database
 */
async function getPatientLanguage(patientId) {
    // Lazy import to avoid circular dependency
    const { Patient } = await Promise.resolve().then(() => __importStar(require("../models/Patient")));
    const patient = await Patient.findByPk(patientId, { attributes: ["language"] });
    return patient?.language || "en";
}
exports.getPatientLanguage = getPatientLanguage;
