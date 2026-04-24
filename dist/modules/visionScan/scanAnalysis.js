"use strict";
/**
 * Scan Analysis — rescan / rejection decision logic.
 *
 * All rescanReasons and dataError are bilingual { english, hindi }.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeScanAnalysis = void 0;
// ─── Helpers ──────────────────────────────────────────────────────────────
const MONTH_NUM = {
    "01": 1, "02": 2, "03": 3, "04": 4, "05": 5, "06": 6,
    "07": 7, "08": 8, "09": 9, "10": 10, "11": 11, "12": 12,
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};
function parseCombinedDate(val) {
    if (!val || typeof val !== "string")
        return null;
    const parts = val.split("/");
    if (parts.length !== 3)
        return null;
    const dd = parseInt(parts[0], 10);
    const mm = parts[1];
    const yy = parseInt(parts[2], 10);
    const mmNum = MONTH_NUM[mm];
    if (isNaN(dd) || !mmNum || isNaN(yy) || dd < 1 || dd > 31)
        return null;
    return { dd, mm, mmNum, yy };
}
function toDate(p) {
    return new Date(p.yy, p.mmNum - 1, p.dd);
}
/** Convert a plain English quality-warning string into a bilingual reason. */
function qualityWarningToBilingual(w) {
    const lw = w.toLowerCase();
    const eng = `Photo: ${w}`;
    let hi = "फ़ोटो: ";
    if (lw.includes("patterned") || lw.includes("plain surface"))
        hi += "डायरी पृष्ठ पैटर्न वाली सतह पर है — सादी सफेद सतह का उपयोग करें";
    else if (lw.includes("angle") || lw.includes("directly above"))
        hi += "कैमरे को डायरी के पेज के बिल्कुल सीधे ऊपर रखें";
    else if (lw.includes("blur") || lw.includes("focus"))
        hi += "छवि धुंधली है — स्थिर रखें और फ़ोकस होने दें";
    else if (lw.includes("lighting") || lw.includes("glare") || lw.includes("shadow"))
        hi += "खराब रोशनी — बेहतर प्रकाश में फ़ोटो लें";
    else if (lw.includes("cut off") || lw.includes("in frame") || lw.includes("edges"))
        hi += "डायरी का पेज पूरा फ्रेम में आना चाहिए — कोई हिस्सा कटा न हो";
    else if (lw.includes("portrait"))
        hi += "फ़ोन को आड़ा (landscape) करके डायरी के पेज की फ़ोटो लें";
    else if (lw.includes("poor") || lw.includes("quality") || lw.includes("retake") || lw.includes("marginal"))
        hi += "फ़ोटो की गुणवत्ता कम है — बेहतर स्थितियों में दोबारा खींचें";
    else
        hi += w; // fallback to English text for unrecognised patterns
    return { english: eng, hindi: hi };
}
// ─── Main export ──────────────────────────────────────────────────────────
function computeScanAnalysis(enrichedResults, questions, processingWarnings, historicalDates = []) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const rescanReasons = [];
    const duplicateDateReasons = [];
    const rejectionReasons = [];
    const dataErrors = [];
    // ── Overall confidence ──────────────────────────────────────────────
    const scores = Object.values(enrichedResults).map(f => f.confidence);
    const overallConfidence = scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : 0;
    if (overallConfidence > 0 && overallConfidence < 0.65) {
        rescanReasons.push({
            english: `Overall confidence is ${overallConfidence} — extraction may be inaccurate`,
            hindi: `समग्र विश्वसनीयता ${overallConfidence} है — निष्कर्षण अशुद्ध हो सकता है`,
        });
    }
    const lowConfFields = Object.entries(enrichedResults)
        .filter(([, f]) => f.confidence < 0.5 && f.answer !== null);
    if (lowConfFields.length >= 1) {
        rescanReasons.push({
            english: `${lowConfFields.length} field(s) have low confidence — verify manually`,
            hindi: `${lowConfFields.length} फ़ील्ड में कम विश्वसनीयता है — कृपया मैन्युअल रूप से सत्यापित करें`,
        });
    }
    // ── Rejection ──────────────────────────────────────────────────────
    const answerableFields = Object.values(enrichedResults)
        .filter((_, i) => questions[i]?.type !== "info");
    const nullFraction = answerableFields.length > 0
        ? answerableFields.filter(f => f.answer === null).length / answerableFields.length
        : 1;
    if (overallConfidence > 0 && overallConfidence < 0.35)
        rejectionReasons.push(`Overall confidence is critically low (${overallConfidence}) — scan is unreliable`);
    if (nullFraction > 0.7 && answerableFields.length > 0)
        rejectionReasons.push(`More than 70% of fields could not be read — image is unreadable`);
    // ── Schedule-page checks ────────────────────────────────────────────
    // isSchedule      — page has at least one date or select field
    // hasStatusFields — page has a select/status field paired with the date
    // Pages like Page 36 (NACT Completed) have a date field recording a PAST
    // completion event with no paired status field. Those must not trigger
    // date/status cross-checks or future-date validation.
    const isSchedule = questions.some(q => q.type === "date" || q.type === "select");
    if (isSchedule) {
        const dateQs = questions.filter(q => q.type === "date");
        const statusQs = questions.filter(q => q.type === "select");
        const hasStatusFields = statusQs.length > 0;
        const fDateField = dateQs[0]?.id ? enrichedResults[dateQs[0].id] : undefined;
        const sDateField = dateQs[1]?.id ? enrichedResults[dateQs[1].id] : undefined;
        const fStatusField = statusQs[0]?.id ? enrichedResults[statusQs[0].id] : undefined;
        const sStatusField = statusQs[1]?.id ? enrichedResults[statusQs[1].id] : undefined;
        const firstDate = parseCombinedDate(fDateField?.answer ?? null);
        const secondDate = parseCombinedDate(sDateField?.answer ?? null);
        const firstStatus = fStatusField?.answer ?? null;
        const secondStatus = sStatusField?.answer ?? null;
        // Low confidence on individual date/status fields
        if (fDateField && fDateField.confidence < 0.5 && fDateField.answer !== null)
            rescanReasons.push({
                english: "First appointment date has low confidence — value may be misread",
                hindi: "पहली अपॉइंटमेंट की तारीख में कम विश्वसनीयता है — मान गलत पढ़ा गया हो सकता है",
            });
        if (sDateField && sDateField.confidence < 0.5 && sDateField.answer !== null)
            rescanReasons.push({
                english: "Second attempt date has low confidence — value may be misread",
                hindi: "दूसरे प्रयास की तारीख में कम विश्वसनीयता है — मान गलत पढ़ा गया हो सकता है",
            });
        if (hasStatusFields && fStatusField && fStatusField.confidence < 0.5 && fStatusField.answer !== null)
            rescanReasons.push({
                english: "First appointment status has low confidence — value may be misread",
                hindi: "पहली अपॉइंटमेंट की स्थिति में कम विश्वसनीयता है — मान गलत पढ़ा गया हो सकता है",
            });
        if (hasStatusFields && sStatusField && sStatusField.confidence < 0.5 && sStatusField.answer !== null)
            rescanReasons.push({
                english: "Second attempt status has low confidence — value may be misread",
                hindi: "दूसरे प्रयास की स्थिति में कम विश्वसनीयता है — मान गलत पढ़ा गया हो सकता है",
            });
        // Chronological order
        if (firstDate && secondDate && toDate(secondDate) <= toDate(firstDate)) {
            rescanReasons.push({
                english: `Second attempt date (${sDateField.answer}) is before first appointment (${fDateField.answer}) — impossible, likely a DD or MM misread`,
                hindi: `दूसरे प्रयास की तारीख (${sDateField.answer}) पहली अपॉइंटमेंट (${fDateField.answer}) से पहले है — यह असंभव है, संभवतः दिन या महीना गलत पढ़ा गया`,
            });
            dataErrors.push({
                english: "Second Appointment should be after First Appointment",
                hindi: "दूसरी अपॉइंटमेंट पहली अपॉइंटमेंट के बाद होनी चाहिए",
            });
        }
        // Year gap > 1 between first and second appointments
        if (firstDate && secondDate && Math.abs(secondDate.yy - firstDate.yy) > 1) {
            rescanReasons.push({
                english: `Year gap between first (${firstDate.yy}) and second attempt (${secondDate.yy}) is implausible — likely a year misread`,
                hindi: `पहली (${firstDate.yy}) और दूसरे प्रयास (${secondDate.yy}) के बीच वर्षों का अंतर अविश्वसनीय है — संभवतः वर्ष गलत पढ़ा गया`,
            });
        }
        // Both dates identical
        if (firstDate && secondDate &&
            firstDate.dd === secondDate.dd &&
            firstDate.mm === secondDate.mm &&
            firstDate.yy === secondDate.yy) {
            rescanReasons.push({
                english: `Both appointments have the same date (${fDateField.answer}) — likely a duplicate misread`,
                hindi: `दोनों अपॉइंटमेंट की एक ही तारीख है (${fDateField.answer}) — संभवतः डुप्लीकेट गलत पठन`,
            });
        }
        // ── Status × Date validation (hasStatusFields pages only) ─────────
        //
        //  SCHEDULED : date must be TODAY or FUTURE  (appointment is upcoming)
        //  COMPLETED : date must be TODAY or PAST    (can't complete future event)
        //  MISSED    : date must be TODAY or PAST    (can't miss future event)
        //  CANCELLED : past OR future both valid     (can cancel upcoming or record past cancellation)
        if (hasStatusFields) {
            // ── First appointment ─────────────────────────────────────────
            // SCHEDULED + past date
            if (firstStatus === "Scheduled" && firstDate && toDate(firstDate) < today) {
                rescanReasons.push({
                    english: `First appointment is 'Scheduled' but date ${fDateField.answer} is in the past — a Scheduled appointment must have a future date`,
                    hindi: `पहली अपॉइंटमेंट 'निर्धारित' है लेकिन तारीख ${fDateField.answer} भूतकाल में है — निर्धारित अपॉइंटमेंट की तारीख भविष्य में होनी चाहिए`,
                });
                dataErrors.push({
                    english: "Scheduled appointment date cannot be in the past",
                    hindi: "निर्धारित अपॉइंटमेंट की तारीख भूतकाल में नहीं हो सकती",
                });
            }
            // COMPLETED + future date (any future date, not just future year)
            if (firstStatus === "Completed" && firstDate && toDate(firstDate) > today) {
                rescanReasons.push({
                    english: `First appointment is 'Completed' but date ${fDateField.answer} is in the future — a Completed appointment must have a past or today's date`,
                    hindi: `पहली अपॉइंटमेंट 'पूर्ण' है लेकिन तारीख ${fDateField.answer} भविष्य में है — पूर्ण अपॉइंटमेंट की तारीख आज या भूतकाल में होनी चाहिए`,
                });
                dataErrors.push({
                    english: "A Completed appointment cannot have a future date",
                    hindi: "पूर्ण अपॉइंटमेंट की तारीख भविष्य में नहीं हो सकती",
                });
            }
            // MISSED + future date
            if (firstStatus === "Missed" && firstDate && toDate(firstDate) > today) {
                rescanReasons.push({
                    english: `First appointment is 'Missed' but date ${fDateField.answer} is in the future — a Missed appointment must have a past or today's date`,
                    hindi: `पहली अपॉइंटमेंट 'छूटी' है लेकिन तारीख ${fDateField.answer} भविष्य में है — छूटी अपॉइंटमेंट की तारीख आज या भूतकाल में होनी चाहिए`,
                });
                dataErrors.push({
                    english: "A Missed appointment cannot have a future date",
                    hindi: "छूटी अपॉइंटमेंट की तारीख भविष्य में नहीं हो सकती",
                });
            }
            // CANCELLED — no date restriction (past and future both valid)
            // ── Second attempt ────────────────────────────────────────────
            // SCHEDULED + past date
            if (secondDate && secondStatus === "Scheduled" && toDate(secondDate) < today) {
                rescanReasons.push({
                    english: `Second attempt is 'Scheduled' but date ${sDateField.answer} is in the past — a Scheduled appointment must have a future date`,
                    hindi: `दूसरा प्रयास 'निर्धारित' है लेकिन तारीख ${sDateField.answer} भूतकाल में है — निर्धारित अपॉइंटमेंट की तारीख भविष्य में होनी चाहिए`,
                });
                dataErrors.push({
                    english: "Second attempt Scheduled date cannot be in the past",
                    hindi: "दूसरे प्रयास की निर्धारित तारीख भूतकाल में नहीं हो सकती",
                });
            }
            // COMPLETED + future date
            if (secondDate && secondStatus === "Completed" && toDate(secondDate) > today) {
                rescanReasons.push({
                    english: `Second attempt is 'Completed' but date ${sDateField.answer} is in the future — a Completed appointment must have a past or today's date`,
                    hindi: `दूसरा प्रयास 'पूर्ण' है लेकिन तारीख ${sDateField.answer} भविष्य में है — पूर्ण अपॉइंटमेंट की तारीख आज या भूतकाल में होनी चाहिए`,
                });
                dataErrors.push({
                    english: "A Completed second attempt cannot have a future date",
                    hindi: "पूर्ण दूसरे प्रयास की तारीख भविष्य में नहीं हो सकती",
                });
            }
            // MISSED + future date
            if (secondDate && secondStatus === "Missed" && toDate(secondDate) > today) {
                rescanReasons.push({
                    english: `Second attempt is 'Missed' but date ${sDateField.answer} is in the future — a Missed appointment must have a past or today's date`,
                    hindi: `दूसरा प्रयास 'छूटा' है लेकिन तारीख ${sDateField.answer} भविष्य में है — छूटी अपॉइंटमेंट की तारीख आज या भूतकाल में होनी चाहिए`,
                });
                dataErrors.push({
                    english: "A Missed second attempt cannot have a future date",
                    hindi: "छूटे दूसरे प्रयास की तारीख भविष्य में नहीं हो सकती",
                });
            }
            // CANCELLED second — no date restriction
            // ── Cross-appointment logic ───────────────────────────────────
            // First SCHEDULED → second section must be blank (appointment hasn't happened yet)
            if (firstStatus === "Scheduled" && sDateField?.answer) {
                rescanReasons.push({
                    english: `First appointment is 'Scheduled' (upcoming) but second attempt section has data — second attempt is only relevant after a Missed or Cancelled first appointment`,
                    hindi: `पहली अपॉइंटमेंट 'निर्धारित' (आगामी) है लेकिन दूसरे प्रयास का भाग भरा है — दूसरा प्रयास केवल छूटी या रद्द अपॉइंटमेंट के बाद प्रासंगिक है`,
                });
            }
            // First COMPLETED → no second attempt needed
            if (firstStatus === "Completed" && sDateField?.answer) {
                rescanReasons.push({
                    english: `Second attempt data is present but first appointment is 'Completed' — second attempt is only for Missed or Cancelled appointments`,
                    hindi: `दूसरे प्रयास का डेटा मौजूद है लेकिन पहली अपॉइंटमेंट 'पूर्ण' है — दूसरा प्रयास केवल छूटी या रद्द अपॉइंटमेंट के लिए है`,
                });
            }
            // First MISSED or CANCELLED → second attempt section expected
            if (["Missed", "Cancelled"].includes(firstStatus ?? "") && !sDateField?.answer) {
                rescanReasons.push({
                    english: `First appointment is '${firstStatus}' but second attempt section appears empty — please check if a second attempt was scheduled`,
                    hindi: `पहली अपॉइंटमेंट '${firstStatus === "Missed" ? "छूटी" : "रद्द"}' है लेकिन दूसरे प्रयास का भाग खाली दिखता है — कृपया जाँचें कि दूसरा प्रयास निर्धारित था या नहीं`,
                });
            }
            // Date/status pairing checks
            if (!fDateField?.answer && fStatusField?.answer) {
                rescanReasons.push({
                    english: "First appointment status is filled but date could not be read",
                    hindi: "पहली अपॉइंटमेंट की स्थिति भरी है लेकिन तारीख नहीं पढ़ी जा सकी",
                });
            }
            if (fDateField?.answer && !fStatusField?.answer) {
                rescanReasons.push({
                    english: "First appointment date is filled but status could not be read",
                    hindi: "पहली अपॉइंटमेंट की तारीख भरी है लेकिन स्थिति नहीं पढ़ी जा सकी",
                });
            }
        }
        // Duplicate-date check against history — only flag "duplicate" if ALL submitted dates are already in history.
        // If at least one date is new (e.g. second attempt added), the scan is legitimate and should be accepted.
        if (historicalDates.length > 0) {
            const newDates = [fDateField?.answer, sDateField?.answer].filter((d) => !!d);
            if (newDates.length > 0) {
                const allDuplicates = newDates.every(d => historicalDates.includes(d));
                if (allDuplicates) {
                    for (const d of newDates) {
                        duplicateDateReasons.push({
                            english: `Date ${d} was already recorded in a previous scan for this page`,
                            hindi: `तारीख ${d} इस पृष्ठ के पिछले स्कैन में पहले से दर्ज है`,
                        });
                    }
                }
            }
        }
    }
    // ── Merge image-quality warnings into rescan reasons ─────────────────
    const qualityPhrases = ["quality", "retake", "patterned", "blurry", "angle", "portrait orientation", "lighting", "cut off"];
    const qualityWarnings = processingWarnings
        .filter(w => qualityPhrases.some(phrase => w.toLowerCase().includes(phrase)))
        .map(qualityWarningToBilingual);
    const allRescanReasons = [...rescanReasons, ...qualityWarnings];
    // ── Final action ──────────────────────────────────────────────────────
    const rejectionRequired = rejectionReasons.length > 0;
    const rescanRequired = allRescanReasons.length > 0;
    const isDuplicateOnly = duplicateDateReasons.length > 0 && !rescanRequired && !rejectionRequired;
    const action = rejectionRequired ? "rejected"
        : rescanRequired ? "rescan_required"
            : isDuplicateOnly ? "duplicate"
                : "success";
    // Merge duplicate reasons into rescanReasons for the response so app has full list
    if (isDuplicateOnly)
        allRescanReasons.push(...duplicateDateReasons);
    const userMessage = action === "rejected"
        ? "This scan could not be processed — the image is unreadable. Please retake it clearly and try again."
        : action === "rescan_required"
            ? "The photo could not be read accurately. Please retake it on a plain surface, held directly above the form, and try again."
            : action === "duplicate"
                ? "This date was already recorded from a previous scan. No need to scan again."
                : "Data extracted successfully.";
    const dataError = dataErrors.length > 0
        ? {
            english: dataErrors.map(e => e.english).join("; "),
            hindi: dataErrors.map(e => e.hindi).join("; "),
        }
        : null;
    return {
        action,
        rescanRequired,
        rescanReasons: allRescanReasons,
        rejectionRequired,
        rejectionReasons,
        dataError,
        alertMessage: action === "rejected" ? "Scan rejected"
            : action === "rescan_required" ? "Rescan is required"
                : action === "duplicate" ? "Already submitted"
                    : null,
        userMessage,
        dataReliable: action === "success" && dataError === null,
        overallConfidence,
    };
}
exports.computeScanAnalysis = computeScanAnalysis;
