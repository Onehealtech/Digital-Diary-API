"use strict";
// // import { DiaryPage } from "../../models/DiaryPage";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDiaryPage = exports.parseLLMResponse = exports.validateResults = exports.mapResponseToBackend = exports.buildAllNullRetryPrompt = exports.buildDateRetryPrompt = exports.buildExtractionPrompt = exports.PAGE_DETECTION_PROMPT = exports.VISION_SCAN_SYSTEM_PROMPT = void 0;
// ─────────────────────── CONSTANTS ──────────────────────
const VALID_MONTHS = new Set([
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]);
const VALID_YEARS = new Set(["2026", "2027", "2028"]);
const MONTH_MAP = {
    // English lowercase
    jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", may: "May", jun: "Jun",
    jul: "Jul", aug: "Aug", sep: "Sep", oct: "Oct", nov: "Nov", dec: "Dec",
    // English full
    january: "Jan", february: "Feb", march: "Mar", april: "Apr",
    june: "Jun", july: "Jul", august: "Aug", september: "Sep",
    october: "Oct", november: "Nov", december: "Dec",
    // Hindi abbreviated
    "जन": "Jan", "फर": "Feb", "मार्च": "Mar", "अप्रैल": "Apr",
    "मई": "May", "जून": "Jun", "जुला": "Jul", "अग": "Aug",
    "सित": "Sep", "अक्तू": "Oct", "नव": "Nov", "दिस": "Dec",
    // Hindi full (only keys not already covered above)
    "जनवरी": "Jan", "फरवरी": "Feb", "जुलाई": "Jul", "अगस्त": "Aug",
    "सितंबर": "Sep", "अक्टूबर": "Oct", "नवंबर": "Nov", "दिसंबर": "Dec",
};
const HINDI_STATUS_MAP = {
    "सारणी": "Scheduled", "संपन्न": "Completed",
    "छूक गया": "Missed", "रद्": "Cancelled",
};
// ═══════════════════════════════════════════════════════════════════════════════
// 1. SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════════════════
exports.VISION_SCAN_SYSTEM_PROMPT = `You are a medical form scanner extracting filled bubble data from photographs of CANTrac breast cancer diary pages.

FORM LAYOUT:
- Page bounded by 4 BLACK SQUARE corner markers. Only read INSIDE these markers.
- Ignore everything outside: table, fabric, hands, shadows, other papers.

BUBBLE APPEARANCE:
- FILLED bubbles can look different depending on the writing instrument:
  * BALLPOINT PEN: solid DARK BLUE/BLACK circle. Very high contrast against the white page.
  * GEL PEN: solid colored circle (blue, black, or other ink color). High contrast.
  * PENCIL/GRAPHITE: GREY or SILVER shaded circle. LOWER contrast than pen — appears as a soft grey fill rather than stark black. The interior looks CLOUDY, SMOKY, or HAZY compared to empty bubbles. May appear faint but is still clearly different from an empty bubble.
- EMPTY = thin PINK outline with WHITE/CLEAN interior. No ink or graphite inside. The interior is crisp and matches the page background.

KEY DETECTION RULE:
A bubble is FILLED only when there is a clear, intentional mark inside it — pen ink, pencil shading, or any deliberate fill that is unmistakably different from a blank circle. The difference must be obvious and unambiguous, not a subtle shade or printing artifact.

BLANK PAGE / UNANSWERED FIELD:
- If ALL bubbles in a row look essentially the same — clean white circles with only their pink outline — then NONE are filled. Return null for that field.
- Do NOT use relative comparison to pick a "more filled" bubble when the difference is tiny or caused by lighting, shadows, image compression, or printing variation.
- The mark must be CLEARLY visible, not just slightly different. When in doubt, return null.

Do NOT require dark black ink to count as filled. A clear pencil mark (visibly grey/shaded interior) also counts — but only when the mark is genuinely obvious, not marginal.

RULES:
- If a bubble row has NO clearly filled bubble, return null for that field with confidence 0.95 — do NOT guess or hallucinate a value.
- Only return a non-null value when you can clearly and confidently see an intentional mark inside a bubble.
- Return ONLY valid JSON. No markdown. No explanation. No code fences. Start with { end with }.`;
// ═══════════════════════════════════════════════════════════════════════════════
// 2. PAGE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════
exports.PAGE_DETECTION_PROMPT = `What is the 2-digit page number at the top center of this CANTrac diary page?
Return JSON only: {"isValidDiaryPage": true, "pageNumber": <number>} or {"isValidDiaryPage": false, "reason": "<brief>"}`;
// ═══════════════════════════════════════════════════════════════════════════════
// 3. EXTRACTION PROMPT — MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════
function buildExtractionPrompt(diaryPage) {
    const types = new Set(diaryPage.questions.filter(q => q.type !== "info").map(q => q.type));
    const isSchedule = types.has("date") || types.has("select");
    return isSchedule
        ? buildSchedulePrompt(diaryPage)
        : buildYesNoPrompt(diaryPage);
}
exports.buildExtractionPrompt = buildExtractionPrompt;
// ─────────────────────── YES/NO PAGES ──────────────────────
function buildYesNoPrompt(diaryPage) {
    const questions = diaryPage.questions.filter(q => q.type !== "info");
    const pageNum = String(diaryPage.pageNumber).padStart(2, "0");
    const fieldList = questions.map(q => {
        if (q.type === "yes_no")
            return `  "${q.id}": "${q.text}" → LEFT bubble = Yes, RIGHT bubble = No`;
        if (q.type === "text")
            return `  "${q.id}": "${q.text}" → read handwritten text, or "" if blank`;
        return `  "${q.id}": "${q.text}" → string | null`;
    }).join("\n");
    const example = {};
    questions.forEach(q => {
        example[q.id] = q.type === "yes_no"
            ? { value: null, confidence: 0.95 }
            : q.type === "text"
                ? { value: "", confidence: 0.90 }
                : { value: null, confidence: 0.95 };
    });
    return `Page ${pageNum}: "${diaryPage.title}"

${questions.length} Yes/No questions. Each row has two bubbles:
- LEFT = Yes(हाँ)   RIGHT = No(नहीं)
- A FILLED bubble has a visible mark inside it (pen ink, pencil shading, grey fill).
- An EMPTY bubble has a clean white interior with only a pink outline — no marks at all.

BLANK PAGE RULE: If BOTH bubbles in a row are empty (no marks in either), return null with confidence 0.95. Do NOT pick a side — null means the question was not answered.

FIELDS:
${fieldList}

Return this EXACT JSON structure:
${JSON.stringify(example, null, 2)}

- If a bubble IS filled, replace null with "yes" or "no" based on which side is filled.
- If NEITHER bubble is filled, keep value as null with confidence 0.95.
- Never copy example values — only return what you actually see in the image.
JSON only. No markdown. No explanation.`;
}
// ─────────────────────── SCHEDULE PAGES ──────────────────────
function buildSchedulePrompt(diaryPage) {
    const questions = diaryPage.questions.filter(q => q.type !== "info");
    const pageNum = String(diaryPage.pageNumber).padStart(2, "0");
    const dateFields = questions.filter(q => q.type === "date");
    const statusFields = questions.filter(q => q.type === "select");
    const yesNoFields = questions.filter(q => q.type === "yes_no");
    const textFields = questions.filter(q => q.type === "text");
    const hasSecond = dateFields.length > 1;
    // ── Section instructions ──
    let sections = "";
    // First appointment
    sections += buildAppointmentSection("FIRST APPOINTMENT (top box on the page)", dateFields[0]?.id, statusFields[0]?.id);
    // Second appointment
    if (hasSecond) {
        sections += buildAppointmentSection('SECOND ATTEMPT (bottom box, labeled "Second Attempt/द्वितीय प्रयास")', dateFields[1]?.id, statusFields[1]?.id);
    }
    // Yes/No at bottom
    for (const yn of yesNoFields) {
        sections += `
═══ BOTTOM OF PAGE ═══
"${yn.id}" — "${yn.text}":
  [○ Yes(हाँ)]  [○ No(नहीं)]
  If the LEFT bubble has a clear mark inside it → value = "yes"
  If the RIGHT bubble has a clear mark inside it → value = "no"
  If NEITHER bubble has any mark → value = null, confidence = 0.95
  Do NOT guess — only return "yes" or "no" when you clearly see a filled bubble.
`;
    }
    // Text fields
    for (const tf of textFields) {
        sections += `\n"${tf.id}" — "${tf.text}": Read handwritten text on the dotted line, or "" if blank.\n`;
    }
    // ── Example output — UNIFORM { value, confidence } for ALL fields ──
    const example = {};
    if (dateFields[0]?.id)
        example[dateFields[0].id] = { value: null, confidence: 0.95 };
    if (statusFields[0]?.id)
        example[statusFields[0].id] = { value: null, confidence: 0.95 };
    if (hasSecond) {
        if (dateFields[1]?.id)
            example[dateFields[1].id] = { value: null, confidence: 0.95 };
        if (statusFields[1]?.id)
            example[statusFields[1].id] = { value: null, confidence: 0.95 };
    }
    for (const yn of yesNoFields)
        example[yn.id] = { value: null, confidence: 0.95 };
    for (const tf of textFields)
        example[tf.id] = { value: "", confidence: 0.90 };
    return `Page ${pageNum}: "${diaryPage.title}"

This is a CANTrac diary schedule page. Each row on the page has a set of options. The user fills in one option per row by marking the circle (bubble) next to their chosen option.

Your job: For each field below, look at the corresponding row on the page and identify which option the user has marked. A marked option has a visibly filled circle (dark ink or pencil shading). An unmarked option has an empty circle with a clean white interior.

If no option in a row is clearly marked → value = null, confidence = 0.95.

${sections}

OUTPUT FORMAT — every field must be:
{ "value": <selected option as a string, or null if nothing marked>, "confidence": <0.0–1.0> }

- Date: combine day + month + year as "DD/MMM/YYYY" using the 3-letter month name (e.g. "14/Apr/2027"). If any of the three rows (day/month/year) has no marked option → value = null.
- Status: one of "Scheduled", "Completed", "Missed", "Cancelled", or null.
- Yes/No: "yes", "no", or null.

Return ONLY this JSON (replace null with the actual selected value where something is clearly marked):
${JSON.stringify(example, null, 2)}

JSON only. No markdown. No explanation. Start with { end with }.`;
}
function buildAppointmentSection(sectionTitle, dateId, statusId) {
    return `
─── ${sectionTitle} ───
${dateId ? `
"${dateId}" — Look inside this section's box for three rows:

  DAY row (labeled "DD: दिन / Day"):
    Options are the numbers 01 through 31 spread across two lines.
    Which day number has its circle marked by the user?

  MONTH row (labeled "MM: माह / Month"):
    Options are: Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov  Dec
    Which month name has its circle marked by the user?
    Convert the month name to a 2-digit number: Jan=01 Feb=02 Mar=03 Apr=04 May=05 Jun=06 Jul=07 Aug=08 Sep=09 Oct=10 Nov=11 Dec=12

  YEAR row (labeled "YY: साल / Year"):
    Options are: 2026  2027  2028
    Which year has its circle marked by the user?

  Combine the three answers as "DD/MMM/YYYY" using the 3-letter month name → e.g. "02/Apr/2026".
  If none of the options in a row are marked → value = null.` : ""}
${statusId ? `
"${statusId}" — Look inside this same section's box for the row labeled "Status / स्थिति":
    Options are: Scheduled  Completed  Missed  Cancelled
    Which option has its circle marked by the user? → that is the status.
    If none are marked → value = null.` : ""}
`;
}
// ═══════════════════════════════════════════════════════════════════════════════
// 4. DATE RETRY PROMPT — for when date extraction fails
// ═══════════════════════════════════════════════════════════════════════════════
function buildDateRetryPrompt(diaryPage, dateFieldId, sectionLabel) {
    const pageNum = String(diaryPage.pageNumber).padStart(2, "0");
    return `Page ${pageNum}: "${diaryPage.title}"

CAREFULLY re-read the date in the "${sectionLabel}" section.

STEP 1 — DD ROW ("DD: दिन"):
  Line 1 bubbles: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16
  Line 2 bubbles: 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
  Which ONE bubble is dark? The number to its RIGHT = day.

STEP 2 — MM ROW ("MM: माह"):
  Bubbles: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec
  Which ONE is dark? The month to its RIGHT = month.
  Convert to 2-digit number: Jan=01 Feb=02 Mar=03 Apr=04 May=05 Jun=06 Jul=07 Aug=08 Sep=09 Oct=10 Nov=11 Dec=12

STEP 3 — YY ROW ("YY: साल"):
  Bubbles: 2026, 2027, 2028
  Which ONE is dark? The year to its RIGHT = year.

Return JSON using "DD/MMM/YYYY" format with 3-letter month name:
{ "${dateFieldId}": { "value": "DD/MMM/YYYY", "confidence": 0.90 } }

Example: { "${dateFieldId}": { "value": "22/Sep/2027", "confidence": 0.92 } }

JSON only. No markdown. No explanation.`;
}
exports.buildDateRetryPrompt = buildDateRetryPrompt;
// ═══════════════════════════════════════════════════════════════════════════════
// 5. ALL-NULL RETRY PROMPT
// ═══════════════════════════════════════════════════════════════════════════════
function buildAllNullRetryPrompt(diaryPage) {
    const questions = diaryPage.questions.filter(q => q.type !== "info");
    const pageNum = String(diaryPage.pageNumber).padStart(2, "0");
    const fieldList = questions.map(q => `"${q.id}": ${q.text} (${q.type})`).join("\n  ");
    const example = {};
    questions.forEach(q => {
        example[q.id] = { value: q.type === "yes_no" ? "yes" : "example", confidence: 0.90 };
    });
    return `RETRY — Previous attempt returned all null. This is wrong. The form has filled bubbles.

Page ${pageNum}: "${diaryPage.title}"

Look at the page again. Filled bubbles are SOLID DARK circles. Empty ones are light pink outlines.

Fields:
  ${fieldList}

Return: ${JSON.stringify(example, null, 2)}

Replace with actual readings. JSON only.`;
}
exports.buildAllNullRetryPrompt = buildAllNullRetryPrompt;
// ═══════════════════════════════════════════════════════════════════════════════
// 6. NORMALIZERS
// ═══════════════════════════════════════════════════════════════════════════════
function normalizeMonth(raw) {
    if (!raw || typeof raw !== "string")
        return null;
    const t = raw.trim();
    if (VALID_MONTHS.has(t))
        return t;
    return MONTH_MAP[t.toLowerCase()] || null;
}
function normalizeDay(raw) {
    const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
    return (!isNaN(n) && n >= 1 && n <= 31) ? n : null;
}
function normalizeYear(raw) {
    const s = String(raw).trim();
    if (VALID_YEARS.has(s))
        return s;
    if (/^\d{2}$/.test(s)) {
        const full = "20" + s;
        if (VALID_YEARS.has(full))
            return full;
    }
    return null;
}
function parseDateString(s) {
    if (!s)
        return null;
    // "20/Sep/2028", "20-Sep-2028", "20 Sep 2028"
    const m1 = s.match(/(\d{1,2})\s*[\/\-\s]\s*(\w+)\s*[\/\-\s]\s*(\d{4})/);
    if (m1) {
        const dd = normalizeDay(m1[1]), mm = normalizeMonth(m1[2]), yy = normalizeYear(m1[3]);
        if (dd && mm && yy)
            return { dd, mm, yy };
    }
    // "Sep 20, 2028"
    const m2 = s.match(/(\w+)\s*[\/\-\s,]\s*(\d{1,2})\s*[\/\-\s,]\s*(\d{4})/);
    if (m2) {
        const mm = normalizeMonth(m2[1]), dd = normalizeDay(m2[2]), yy = normalizeYear(m2[3]);
        if (dd && mm && yy)
            return { dd, mm, yy };
    }
    // "2028-09-20" (ISO)
    const m3 = s.match(/(\d{4})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{1,2})/);
    if (m3) {
        const yy = normalizeYear(m3[1]);
        const monthNum = parseInt(m3[2], 10);
        const dd = normalizeDay(m3[3]);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const mm = (monthNum >= 1 && monthNum <= 12) ? months[monthNum - 1] : null;
        if (dd && mm && yy)
            return { dd, mm, yy };
    }
    return null;
}
/**
 * Extracts a date string from any response shape the AI might return.
 * Handles: { value }, { date_string }, { dd, mm, yy }, { answer }, plain string
 */
function extractDateValue(raw) {
    if (typeof raw === "string") {
        const p = parseDateString(raw);
        return p ? `${String(p.dd).padStart(2, "0")}/${p.mm}/${p.yy}` : null;
    }
    if (!raw || typeof raw !== "object")
        return null;
    // Try each possible key the AI might use for the combined date
    for (const key of ["value", "date_string", "answer", "date"]) {
        if (raw[key] && typeof raw[key] === "string") {
            const p = parseDateString(raw[key]);
            if (p)
                return `${String(p.dd).padStart(2, "0")}/${p.mm}/${p.yy}`;
        }
    }
    // Decomposed: { dd, mm, yy }
    if ("dd" in raw && "mm" in raw && "yy" in raw) {
        const dd = normalizeDay(raw.dd);
        const mm = normalizeMonth(raw.mm);
        const yy = normalizeYear(raw.yy);
        if (dd && mm && yy)
            return `${String(dd).padStart(2, "0")}/${mm}/${yy}`;
    }
    // Decomposed with different key names
    if ("day" in raw && "month" in raw && "year" in raw) {
        const dd = normalizeDay(raw.day);
        const mm = normalizeMonth(raw.month);
        const yy = normalizeYear(raw.year);
        if (dd && mm && yy)
            return `${String(dd).padStart(2, "0")}/${mm}/${yy}`;
    }
    return null;
}
// ═══════════════════════════════════════════════════════════════════════════════
// 7. RESPONSE MAPPER
// ═══════════════════════════════════════════════════════════════════════════════
function mapResponseToBackend(parsed, diaryPage) {
    const questions = diaryPage.questions.filter(q => q.type !== "info");
    const results = {};
    // Locate field data — handle nesting variations
    const metaKeys = new Set([
        "_page_verified", "_image_quality", "_retry_notes",
        "page_number", "page_verified", "image_quality",
        "error", "detected_page", "pageNumber", "title",
    ]);
    let fieldData;
    if (parsed.fields && typeof parsed.fields === "object") {
        fieldData = parsed.fields;
    }
    else {
        fieldData = {};
        for (const [k, v] of Object.entries(parsed)) {
            if (!metaKeys.has(k))
                fieldData[k] = v;
        }
    }
    for (const q of questions) {
        let raw = fieldData[q.id];
        const category = (q.type === "date" || q.type === "select") ? "schedule" : "general";
        // Fuzzy key match
        if (raw === undefined) {
            const fuzzyKey = Object.keys(fieldData).find(k => k.toLowerCase().replace(/[_\-\s]/g, "") === q.id.toLowerCase().replace(/[_\-\s]/g, ""));
            if (fuzzyKey)
                raw = fieldData[fuzzyKey];
        }
        if (raw === undefined || raw === null) {
            results[q.id] = { answer: null, category, confidence: 0, questionText: q.text };
            continue;
        }
        // ── Extract value + confidence ──
        let value = null;
        let confidence = 0;
        if (typeof raw === "object" && raw !== null) {
            confidence = typeof raw.confidence === "number" ? raw.confidence : 0.85;
            switch (q.type) {
                case "date":
                    value = extractDateValue(raw);
                    break;
                case "select":
                    value = raw.value ?? raw.answer ?? null;
                    if (value != null && q.options) {
                        const match = q.options.find(o => o.toLowerCase() === String(value).toLowerCase().trim());
                        value = match || HINDI_STATUS_MAP[String(value).trim()] || null;
                    }
                    break;
                case "yes_no":
                    value = raw.value ?? raw.answer ?? null;
                    if (value != null) {
                        const lower = String(value).toLowerCase().trim();
                        if (["yes", "हाँ", "haan", "true"].includes(lower))
                            value = "yes";
                        else if (["no", "नहीं", "nahi", "false"].includes(lower))
                            value = "no";
                        else
                            value = null;
                    }
                    if (typeof value === "boolean")
                        value = value ? "yes" : "no";
                    break;
                default:
                    value = raw.value ?? raw.answer ?? null;
            }
        }
        else {
            // Plain value (string, number, boolean)
            confidence = 0.85;
            switch (q.type) {
                case "date":
                    value = extractDateValue(raw);
                    break;
                case "yes_no": {
                    const lower = String(raw).toLowerCase().trim();
                    if (["yes", "हाँ", "true"].includes(lower))
                        value = "yes";
                    else if (["no", "नहीं", "false"].includes(lower))
                        value = "no";
                    else
                        value = null;
                    break;
                }
                case "select":
                    if (q.options) {
                        const match = q.options.find(o => o.toLowerCase() === String(raw).toLowerCase().trim());
                        value = match || null;
                    }
                    else {
                        value = raw;
                    }
                    break;
                default:
                    value = raw;
            }
        }
        results[q.id] = {
            answer: value,
            category,
            confidence: Math.min(Math.max(confidence, 0), 1),
            questionText: q.text,
        };
    }
    return results;
}
exports.mapResponseToBackend = mapResponseToBackend;
// ═══════════════════════════════════════════════════════════════════════════════
// 8. VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════
function validateResults(results, diaryPage) {
    const questions = diaryPage.questions.filter(q => q.type !== "info");
    const expectedIds = questions.map(q => q.id);
    const resultIds = new Set(Object.keys(results));
    const missingFields = expectedIds.filter(id => !resultIds.has(id));
    const allNull = Object.values(results).every(r => r.answer === null);
    const badDates = [];
    const lowConfidenceFields = [];
    const errors = [];
    for (const q of questions) {
        const r = results[q.id];
        if (!r)
            continue;
        if (r.confidence > 0 && r.confidence < 0.7)
            lowConfidenceFields.push(q.id);
        if (q.type === "date") {
            if (r.answer === null && r.confidence > 0) {
                // AI returned data but we couldn't parse it — flag for retry
                badDates.push(q.id);
                errors.push(`${q.id}: date returned but could not be parsed`);
            }
            else if (r.answer !== null) {
                const dateStr = String(r.answer);
                const match = dateStr.match(/^(\d{2})\/(\w{3})\/(\d{4})$/);
                if (!match) {
                    badDates.push(q.id);
                    errors.push(`${q.id}: invalid date format "${dateStr}"`);
                }
                else {
                    const [, dayStr, month, year] = match;
                    const day = parseInt(dayStr, 10);
                    if (day < 1 || day > 31) {
                        badDates.push(q.id);
                        errors.push(`${q.id}: day ${day} out of range`);
                    }
                    if (!VALID_MONTHS.has(month)) {
                        badDates.push(q.id);
                        errors.push(`${q.id}: invalid month "${month}"`);
                    }
                    if (!VALID_YEARS.has(year)) {
                        badDates.push(q.id);
                        errors.push(`${q.id}: year "${year}" out of range`);
                    }
                }
            }
        }
        if (q.type === "select" && r.answer !== null && q.options) {
            if (!q.options.includes(r.answer)) {
                errors.push(`${q.id}: "${r.answer}" not in [${q.options.join(", ")}]`);
            }
        }
        if (q.type === "yes_no" && r.answer !== null) {
            if (!["yes", "no"].includes(r.answer)) {
                errors.push(`${q.id}: invalid yes_no value "${r.answer}"`);
            }
        }
    }
    if (missingFields.length > 0)
        errors.push(`Missing: ${missingFields.join(", ")}`);
    if (allNull)
        errors.push("All null — likely extraction failure");
    return { valid: errors.length === 0 && !allNull, allNull, missingFields, badDates, lowConfidenceFields, errors };
}
exports.validateResults = validateResults;
// ═══════════════════════════════════════════════════════════════════════════════
// 9. JSON PARSER
// ═══════════════════════════════════════════════════════════════════════════════
function parseLLMResponse(raw) {
    if (!raw || typeof raw !== "string")
        throw new Error("Empty AI response");
    const strategies = [
        () => JSON.parse(raw),
        () => JSON.parse(raw.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/\s*```[\s\S]*$/, "").trim()),
        () => { const m = raw.match(/\{[\s\S]*\}/); if (!m)
            throw 0; return JSON.parse(m[0]); },
        () => {
            const c = raw.replace(/[\u0000-\u001F\uFEFF\u200B-\u200D]/g, "");
            const m = c.match(/\{[\s\S]*\}/);
            if (!m)
                throw 0;
            return JSON.parse(m[0]);
        },
        () => {
            const m = raw.match(/\[[\s\S]*\]/);
            if (!m)
                throw 0;
            const arr = JSON.parse(m[0]);
            return arr[0];
        },
    ];
    for (const s of strategies) {
        try {
            return s();
        }
        catch {
            continue;
        }
    }
    throw new Error(`JSON parse failed. Raw (500 chars): ${raw.slice(0, 500)}`);
}
exports.parseLLMResponse = parseLLMResponse;
// ═══════════════════════════════════════════════════════════════════════════════
// 10. ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════
async function extractDiaryPage(imageUrl, diaryPage, callVisionAPI) {
    const baseOpts = {
        system: exports.VISION_SCAN_SYSTEM_PROMPT,
        imageUrl,
        maxTokens: 1500,
        temperature: 0.1,
        responseFormat: { type: "json_object" },
    };
    // ── PASS 1: Primary extraction ──
    const prompt = buildExtractionPrompt(diaryPage);
    const raw1 = await callVisionAPI({ ...baseOpts, prompt });
    console.log("[CANTrac] Raw AI response:", raw1);
    const parsed1 = parseLLMResponse(raw1);
    console.log("[CANTrac] Parsed JSON:", JSON.stringify(parsed1, null, 2));
    let results = mapResponseToBackend(parsed1, diaryPage);
    let validation = validateResults(results, diaryPage);
    console.log("[CANTrac] Pass 1 validation:", JSON.stringify(validation));
    if (validation.valid)
        return results;
    // ── PASS 2: All-null retry ──
    if (validation.allNull) {
        console.warn("[CANTrac] All null — retrying...");
        const raw2 = await callVisionAPI({
            ...baseOpts,
            prompt: buildAllNullRetryPrompt(diaryPage),
        });
        const parsed2 = parseLLMResponse(raw2);
        const mapped2 = mapResponseToBackend(parsed2, diaryPage);
        const v2 = validateResults(mapped2, diaryPage);
        if (!v2.allNull) {
            results = mapped2;
            validation = v2;
        }
        else {
            console.warn("[CANTrac] Still all null after retry");
            return results;
        }
    }
    // ── PASS 3: Date-specific retry ──
    if (validation.badDates.length > 0) {
        for (const dateId of validation.badDates) {
            const sectionLabel = dateId.includes("q1") || dateId.includes("first")
                ? "First Appointment"
                : "Second Attempt";
            console.log(`[CANTrac] Retrying date field: ${dateId}`);
            const rawRetry = await callVisionAPI({
                ...baseOpts,
                prompt: buildDateRetryPrompt(diaryPage, dateId, sectionLabel),
            });
            const parsedRetry = parseLLMResponse(rawRetry);
            const mappedRetry = mapResponseToBackend(parsedRetry, diaryPage);
            if (mappedRetry[dateId]?.answer !== null) {
                results[dateId] = mappedRetry[dateId];
            }
        }
    }
    // ── PASS 4: Low confidence field retry ──
    if (validation.lowConfidenceFields.length > 0 && validation.lowConfidenceFields.length <= 5) {
        const retryQuestions = diaryPage.questions.filter(q => validation.lowConfidenceFields.includes(q.id));
        const fieldLines = retryQuestions.map(q => `"${q.id}": ${q.text} (${q.type})`).join("\n  ");
        const retryPrompt = `Re-examine these uncertain fields on Page ${diaryPage.pageNumber}:
  ${fieldLines}

Return JSON: { "<field_id>": { "value": ..., "confidence": ... }, ... }
JSON only.`;
        const rawRetry = await callVisionAPI({ ...baseOpts, prompt: retryPrompt });
        const parsedRetry = parseLLMResponse(rawRetry);
        const mappedRetry = mapResponseToBackend(parsedRetry, diaryPage);
        for (const [id, retryResult] of Object.entries(mappedRetry)) {
            if (retryResult.answer !== null && retryResult.confidence > (results[id]?.confidence || 0)) {
                results[id] = retryResult;
            }
        }
    }
    return results;
}
exports.extractDiaryPage = extractDiaryPage;
