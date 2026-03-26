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
exports.translateArrayFields = exports.translateFields = exports.translateBatch = exports.translateText = exports.transliterateBatch = exports.transliterateName = exports.getPatientLanguage = exports.translateReminderStatus = exports.translateReminderType = exports.translateCaseType = exports.translateStatus = exports.t = void 0;
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
// ── Transliteration via Google Input Tools (phonetic script conversion) ───
/**
 * Transliterate text to Hindi script using Google Input Tools API.
 * This converts names phonetically: "Raj Kumar" → "राज कुमार"
 * Unlike translation, this preserves the meaning/pronunciation.
 */
async function transliterateName(text, targetLang = "hi") {
    if (!text || !text.trim() || targetLang === "en")
        return text;
    try {
        // Transliterate each word separately for better results with names
        const words = text.trim().split(/\s+/);
        const transliterated = [];
        for (const word of words) {
            const url = `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=hi-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8`;
            const response = await fetch(url);
            const data = await response.json();
            if (data[0] === "SUCCESS" && data[1]?.[0]?.[1]?.length > 0) {
                transliterated.push(data[1][0][1][0]);
            }
            else {
                transliterated.push(word); // Keep original if no suggestion
            }
        }
        return transliterated.join(" ");
    }
    catch (err) {
        console.error("Transliteration error:", err);
        return text;
    }
}
exports.transliterateName = transliterateName;
/**
 * Batch-transliterate multiple name strings.
 * Returns transliterations in the same order as input.
 */
async function transliterateBatch(texts, targetLang = "hi") {
    if (targetLang === "en" || texts.length === 0)
        return texts;
    return Promise.all(texts.map((t) => transliterateName(t, targetLang)));
}
exports.transliterateBatch = transliterateBatch;
// ── Dynamic translation via Google Translate API ─────────────────
/**
 * Lazy-loaded google-translate-api-x module.
 * Caches the import so we only do the dynamic ESM import once.
 */
let _translateFn = null;
async function getTranslateFn() {
    if (!_translateFn) {
        const { default: translate } = await Function('return import("google-translate-api-x")')();
        _translateFn = translate;
    }
    return _translateFn;
}
/**
 * Translate a single text string to the target language using Google Translate.
 * Returns original text on failure.
 */
async function translateText(text, targetLang = "hi") {
    if (!text || targetLang === "en")
        return text;
    try {
        const translate = await getTranslateFn();
        const result = await translate(text, { to: targetLang });
        return result.text;
    }
    catch (err) {
        console.error("Translation error:", err);
        return text;
    }
}
exports.translateText = translateText;
/**
 * Batch-translate multiple strings in one call for efficiency.
 * Returns translations in the same order as input.
 */
async function translateBatch(texts, targetLang = "hi") {
    if (targetLang === "en" || texts.length === 0)
        return texts;
    // Filter out empty strings, translate non-empty ones
    const nonEmpty = texts.map((txt, i) => ({ txt, i })).filter((x) => x.txt && x.txt.trim());
    if (nonEmpty.length === 0)
        return texts;
    try {
        const translate = await getTranslateFn();
        const results = await Promise.all(nonEmpty.map((x) => translate(x.txt, { to: targetLang })));
        const output = [...texts];
        nonEmpty.forEach((x, idx) => {
            output[x.i] = results[idx].text;
        });
        return output;
    }
    catch (err) {
        console.error("Batch translation error:", err);
        return texts;
    }
}
exports.translateBatch = translateBatch;
/**
 * Translate specified fields of an object using Google Translate.
 * Only translates when language is "hi". Fields not found are skipped.
 *
 * @param obj - The object to translate
 * @param fields - Fields to translate (descriptive text: specialization, hospital, messages)
 * @param lang - Target language
 * @param nameFields - Fields to transliterate (proper nouns: doctor name, patient name).
 *   These use phonetic script conversion instead of meaning-based translation.
 *
 * @example
 *   const data = { fullName: "Dr. Sharma", hospital: "AIIMS Delhi" };
 *   const result = await translateFields(data, ["hospital"], "hi", ["fullName"]);
 *   // { fullName: "डॉ. शर्मा", hospital: "एम्स दिल्ली" }
 */
async function translateFields(obj, fields, lang, nameFields = []) {
    if (lang === "en" || !obj)
        return obj;
    // Collect translate values
    const translateValues = [];
    const translateValidFields = [];
    for (const field of fields) {
        const val = getNestedValue(obj, field);
        if (typeof val === "string" && val.trim()) {
            translateValues.push(val);
            translateValidFields.push(field);
        }
    }
    // Collect transliterate values (names)
    const nameValues = [];
    const nameValidFields = [];
    for (const field of nameFields) {
        const val = getNestedValue(obj, field);
        if (typeof val === "string" && val.trim()) {
            nameValues.push(val);
            nameValidFields.push(field);
        }
    }
    if (translateValues.length === 0 && nameValues.length === 0)
        return obj;
    // Run both in parallel
    const [translated, transliterated] = await Promise.all([
        translateValues.length > 0 ? translateBatch(translateValues, lang) : [],
        nameValues.length > 0 ? transliterateBatch(nameValues, lang) : [],
    ]);
    const result = { ...obj };
    translateValidFields.forEach((field, i) => {
        setNestedValue(result, field, translated[i]);
    });
    nameValidFields.forEach((field, i) => {
        setNestedValue(result, field, transliterated[i]);
    });
    return result;
}
exports.translateFields = translateFields;
/**
 * Translate specified fields across an array of objects.
 * Batches all translations into minimal API calls for efficiency.
 *
 * @param arr - Array of objects
 * @param fields - Fields to translate (descriptive text)
 * @param lang - Target language
 * @param nameFields - Fields to transliterate (proper nouns/names)
 */
async function translateArrayFields(arr, fields, lang, nameFields = []) {
    if (lang === "en" || arr.length === 0)
        return arr;
    // Collect translate values
    const translateValues = [];
    const translateMapping = [];
    // Collect transliterate values (names)
    const nameValues = [];
    const nameMapping = [];
    for (let arrIdx = 0; arrIdx < arr.length; arrIdx++) {
        for (const field of fields) {
            const val = getNestedValue(arr[arrIdx], field);
            if (typeof val === "string" && val.trim()) {
                translateMapping.push({ arrIdx, field, batchIdx: translateValues.length });
                translateValues.push(val);
            }
        }
        for (const field of nameFields) {
            const val = getNestedValue(arr[arrIdx], field);
            if (typeof val === "string" && val.trim()) {
                nameMapping.push({ arrIdx, field, batchIdx: nameValues.length });
                nameValues.push(val);
            }
        }
    }
    if (translateValues.length === 0 && nameValues.length === 0)
        return arr;
    // Run both in parallel
    const [translated, transliterated] = await Promise.all([
        translateValues.length > 0 ? translateBatch(translateValues, lang) : [],
        nameValues.length > 0 ? transliterateBatch(nameValues, lang) : [],
    ]);
    const result = arr.map((item) => ({ ...item }));
    for (const m of translateMapping) {
        setNestedValue(result[m.arrIdx], m.field, translated[m.batchIdx]);
    }
    for (const m of nameMapping) {
        setNestedValue(result[m.arrIdx], m.field, transliterated[m.batchIdx]);
    }
    return result;
}
exports.translateArrayFields = translateArrayFields;
// ── Nested field helpers ─────────────────────────────────────────
function getNestedValue(obj, path) {
    return path.split(".").reduce((o, key) => o?.[key], obj);
}
function setNestedValue(obj, path, value) {
    const keys = path.split(".");
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]])
            return;
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
}
