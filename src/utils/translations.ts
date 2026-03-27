/**
 * Patient-facing translations (English + Hindi)
 * Used to translate API response labels when patient language is "hi"
 */

export type SupportedLanguage = "en" | "hi";

const translations: Record<string, Record<SupportedLanguage, string>> = {
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
export function t(key: string, lang: SupportedLanguage = "en"): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang] || entry.en || key;
}

/**
 * Translate a status value (e.g., "ACTIVE" → "सक्रिय" for Hindi)
 */
export function translateStatus(status: string, lang: SupportedLanguage = "en"): string {
  return t(`status.${status}`, lang);
}

/**
 * Translate a case type value
 */
export function translateCaseType(caseType: string, lang: SupportedLanguage = "en"): string {
  return t(`caseType.${caseType}`, lang);
}

/**
 * Translate a reminder type
 */
export function translateReminderType(type: string, lang: SupportedLanguage = "en"): string {
  return t(`reminderType.${type}`, lang);
}

/**
 * Translate a reminder status
 */
export function translateReminderStatus(status: string, lang: SupportedLanguage = "en"): string {
  return t(`reminderStatus.${status}`, lang);
}

/**
 * Get patient language from the database
 */
export async function getPatientLanguage(patientId: string): Promise<SupportedLanguage> {
  // Lazy import to avoid circular dependency
  const { Patient } = await import("../models/Patient");
  const patient = await Patient.findByPk(patientId, { attributes: ["language"] });
  return (patient?.language as SupportedLanguage) || "en";
}

// ── Transliteration (phonetic script conversion) ─────────────────

/**
 * Transliterate a name to the target language script (phonetic conversion).
 * Uses Google Translate with a transliteration hint.
 * Returns original text on failure.
 */
export async function transliterateName(
  name: string,
  targetLang: SupportedLanguage = "hi"
): Promise<string> {
  if (!name || targetLang === "en") return name;
  try {
    const translate = await getTranslateFn();
    const result = await translate(name, { to: targetLang });
    return result.text;
  } catch (err) {
    console.error("Transliteration error:", err);
    return name;
  }
}

/**
 * Batch-transliterate multiple name strings.
 * Returns transliterations in the same order as input.
 */
export async function transliterateBatch(
  texts: string[],
  targetLang: SupportedLanguage = "hi"
): Promise<string[]> {
  if (targetLang === "en" || texts.length === 0) return texts;

  try {
    const translate = await getTranslateFn();
    const results = await Promise.all(
      texts.map((txt) => (txt && txt.trim() ? translate(txt, { to: targetLang }) : Promise.resolve({ text: txt })))
    );
    return results.map((r) => r.text);
  } catch (err) {
    console.error("Batch transliteration error:", err);
    return texts;
  }
}

// ── Dynamic translation via Google Translate API ─────────────────

/**
 * Lazy-loaded google-translate-api-x module.
 * Caches the import so we only do the dynamic ESM import once.
 */
let _translateFn: ((text: string, opts: { to: string }) => Promise<{ text: string }>) | null = null;

async function getTranslateFn() {
  if (!_translateFn) {
    const { default: translate } = await (Function(
      'return import("google-translate-api-x")'
    )() as Promise<any>);
    _translateFn = translate;
  }
  return _translateFn!;
}

/**
 * Translate a single text string to the target language using Google Translate.
 * Returns original text on failure.
 */
export async function translateText(
  text: string,
  targetLang: SupportedLanguage = "hi"
): Promise<string> {
  if (!text || targetLang === "en") return text;
  try {
    const translate = await getTranslateFn();
    const result = await translate(text, { to: targetLang });
    return result.text;
  } catch (err) {
    console.error("Translation error:", err);
    return text;
  }
}

/**
 * Batch-translate multiple strings in one call for efficiency.
 * Returns translations in the same order as input.
 */
export async function translateBatch(
  texts: string[],
  targetLang: SupportedLanguage = "hi"
): Promise<string[]> {
  if (targetLang === "en" || texts.length === 0) return texts;

  // Filter out empty strings, translate non-empty ones
  const nonEmpty = texts.map((txt, i) => ({ txt, i })).filter((x) => x.txt && x.txt.trim());
  if (nonEmpty.length === 0) return texts;

  try {
    const translate = await getTranslateFn();
    const results = await Promise.all(
      nonEmpty.map((x) => translate(x.txt, { to: targetLang }))
    );

    const output = [...texts];
    nonEmpty.forEach((x, idx) => {
      output[x.i] = results[idx].text;
    });
    return output;
  } catch (err) {
    console.error("Batch translation error:", err);
    return texts;
  }
}

/**
 * Translate specified fields of an object using Google Translate.
 * Only translates when language is "hi". Fields not found are skipped.
 *
 * @example
 *   const data = { fullName: "Dr. Sharma", message: "Hello", id: "abc" };
 *   const translated = await translateFields(data, ["fullName", "message"], "hi");
 *   // { fullName: "डॉ. शर्मा", message: "नमस्ते", id: "abc" }
 */
export async function translateFields<T extends Record<string, any>>(
  obj: T,
  fields: string[],
  lang: SupportedLanguage
): Promise<T> {
  if (lang === "en" || !obj) return obj;

  const values: string[] = [];
  const validFields: string[] = [];

  for (const field of fields) {
    const val = getNestedValue(obj, field);
    if (typeof val === "string" && val.trim()) {
      values.push(val);
      validFields.push(field);
    }
  }

  if (values.length === 0) return obj;

  const translated = await translateBatch(values, lang);
  const result = { ...obj };

  validFields.forEach((field, i) => {
    setNestedValue(result, field, translated[i]);
  });

  return result;
}

/**
 * Translate specified fields across an array of objects.
 * Batches all translations into minimal API calls for efficiency.
 */
export async function translateArrayFields<T extends Record<string, any>>(
  arr: T[],
  fields: string[],
  lang: SupportedLanguage,
  transliterateFields?: string[]
): Promise<T[]> {
  if (lang === "en" || arr.length === 0) return arr;

  // Collect all values to translate with their positions
  const allValues: string[] = [];
  const mapping: { arrIdx: number; field: string; batchIdx: number }[] = [];

  // Collect transliterate values separately
  const allTranslitValues: string[] = [];
  const translitMapping: { arrIdx: number; field: string; batchIdx: number }[] = [];

  for (let arrIdx = 0; arrIdx < arr.length; arrIdx++) {
    for (const field of fields) {
      const val = getNestedValue(arr[arrIdx], field);
      if (typeof val === "string" && val.trim()) {
        mapping.push({ arrIdx, field, batchIdx: allValues.length });
        allValues.push(val);
      }
    }
    if (transliterateFields) {
      for (const field of transliterateFields) {
        const val = getNestedValue(arr[arrIdx], field);
        if (typeof val === "string" && val.trim()) {
          translitMapping.push({ arrIdx, field, batchIdx: allTranslitValues.length });
          allTranslitValues.push(val);
        }
      }
    }
  }

  if (allValues.length === 0 && allTranslitValues.length === 0) return arr;

  const [translated, transliterated] = await Promise.all([
    allValues.length > 0 ? translateBatch(allValues, lang) : [],
    allTranslitValues.length > 0 ? transliterateBatch(allTranslitValues, lang) : [],
  ]);

  const result = arr.map((item) => ({ ...item }));

  for (const m of mapping) {
    setNestedValue(result[m.arrIdx], m.field, translated[m.batchIdx]);
  }
  for (const m of translitMapping) {
    setNestedValue(result[m.arrIdx], m.field, transliterated[m.batchIdx]);
  }

  return result;
}

// ── Nested field helpers ─────────────────────────────────────────

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((o, key) => o?.[key], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) return;
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}
