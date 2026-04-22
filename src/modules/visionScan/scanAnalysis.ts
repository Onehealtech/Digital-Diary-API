/**
 * Scan Analysis — rescan / rejection decision logic.
 *
 * All rescanReasons and dataError are bilingual { english, hindi }.
 */

import { DiaryQuestion, EnrichedResult } from "./visionScan.types";

// ─── Public types ──────────────────────────────────────────────────────────

export type ScanAction = "success" | "rescan_required" | "rejected";

export interface BilingualMessage { english: string; hindi: string; }

export interface ScanAnalysis {
    action:             ScanAction;
    rescanRequired:     boolean;
    rescanReasons:      BilingualMessage[];
    rejectionRequired:  boolean;
    rejectionReasons:   string[];
    dataError:          BilingualMessage | null;
    alertMessage:       string | null;
    userMessage:        string;
    dataReliable:       boolean;
    overallConfidence:  number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const MONTH_NUM: Record<string, number> = {
    "01":1, "02":2, "03":3, "04":4, "05":5,  "06":6,
    "07":7, "08":8, "09":9, "10":10,"11":11, "12":12,
    Jan:1, Feb:2, Mar:3, Apr:4, May:5, Jun:6,
    Jul:7, Aug:8, Sep:9, Oct:10,Nov:11,Dec:12,
};

interface ParsedDate { dd: number; mm: string; mmNum: number; yy: number }

function parseCombinedDate(val: string | null): ParsedDate | null {
    if (!val || typeof val !== "string") return null;
    const parts = val.split("/");
    if (parts.length !== 3) return null;
    const dd = parseInt(parts[0], 10);
    const mm = parts[1];
    const yy = parseInt(parts[2], 10);
    const mmNum = MONTH_NUM[mm];
    if (isNaN(dd) || !mmNum || isNaN(yy) || dd < 1 || dd > 31) return null;
    return { dd, mm, mmNum, yy };
}

function toDate(p: ParsedDate): Date {
    return new Date(p.yy, p.mmNum - 1, p.dd);
}

/** Convert a plain English quality-warning string into a bilingual reason. */
function qualityWarningToBilingual(w: string): BilingualMessage {
    const lw  = w.toLowerCase();
    const eng = `Photo: ${w}`;
    let hi    = "फ़ोटो: ";

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

export function computeScanAnalysis(
    enrichedResults: Record<string, EnrichedResult>,
    questions: DiaryQuestion[],
    processingWarnings: string[],
    historicalDates: string[] = []
): ScanAnalysis {
    const now         = new Date();
    const today       = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const currentYear = now.getFullYear();

    const rescanReasons: BilingualMessage[] = [];
    const rejectionReasons: string[]        = [];
    const dataErrors: BilingualMessage[]    = [];

    // ── Overall confidence ──────────────────────────────────────────────
    const scores = Object.values(enrichedResults).map(f => f.confidence);
    const overallConfidence = scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : 0;

    if (overallConfidence > 0 && overallConfidence < 0.65) {
        rescanReasons.push({
            english: `Overall confidence is ${overallConfidence} — extraction may be inaccurate`,
            hindi:   `समग्र विश्वसनीयता ${overallConfidence} है — निष्कर्षण अशुद्ध हो सकता है`,
        });
    }

    const lowConfFields = Object.entries(enrichedResults)
        .filter(([, f]) => f.confidence < 0.5 && f.answer !== null);
    if (lowConfFields.length >= 1) {
        rescanReasons.push({
            english: `${lowConfFields.length} field(s) have low confidence — verify manually`,
            hindi:   `${lowConfFields.length} फ़ील्ड में कम विश्वसनीयता है — कृपया मैन्युअल रूप से सत्यापित करें`,
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
        const dateQs        = questions.filter(q => q.type === "date");
        const statusQs      = questions.filter(q => q.type === "select");
        const hasStatusFields = statusQs.length > 0;

        const fDateField  = dateQs[0]?.id   ? enrichedResults[dateQs[0].id]   : undefined;
        const sDateField  = dateQs[1]?.id   ? enrichedResults[dateQs[1].id]   : undefined;
        const fStatusField = statusQs[0]?.id ? enrichedResults[statusQs[0].id] : undefined;
        const sStatusField = statusQs[1]?.id ? enrichedResults[statusQs[1].id] : undefined;

        const firstDate   = parseCombinedDate(fDateField?.answer  ?? null);
        const secondDate  = parseCombinedDate(sDateField?.answer  ?? null);
        const firstStatus = fStatusField?.answer ?? null;

        // Low confidence on individual date/status fields
        if (fDateField  && fDateField.confidence  < 0.5 && fDateField.answer  !== null)
            rescanReasons.push({
                english: "First appointment date has low confidence — value may be misread",
                hindi:   "पहली अपॉइंटमेंट की तारीख में कम विश्वसनीयता है — मान गलत पढ़ा गया हो सकता है",
            });
        if (sDateField  && sDateField.confidence  < 0.5 && sDateField.answer  !== null)
            rescanReasons.push({
                english: "Second attempt date has low confidence — value may be misread",
                hindi:   "दूसरे प्रयास की तारीख में कम विश्वसनीयता है — मान गलत पढ़ा गया हो सकता है",
            });
        if (hasStatusFields && fStatusField && fStatusField.confidence < 0.5 && fStatusField.answer !== null)
            rescanReasons.push({
                english: "First appointment status has low confidence — value may be misread",
                hindi:   "पहली अपॉइंटमेंट की स्थिति में कम विश्वसनीयता है — मान गलत पढ़ा गया हो सकता है",
            });
        if (hasStatusFields && sStatusField && sStatusField.confidence < 0.5 && sStatusField.answer !== null)
            rescanReasons.push({
                english: "Second attempt status has low confidence — value may be misread",
                hindi:   "दूसरे प्रयास की स्थिति में कम विश्वसनीयता है — मान गलत पढ़ा गया हो सकता है",
            });

        // Chronological order
        if (firstDate && secondDate && toDate(secondDate) <= toDate(firstDate)) {
            rescanReasons.push({
                english: `Second attempt date (${sDateField!.answer}) is before first appointment (${fDateField!.answer}) — impossible, likely a DD or MM misread`,
                hindi:   `दूसरे प्रयास की तारीख (${sDateField!.answer}) पहली अपॉइंटमेंट (${fDateField!.answer}) से पहले है — यह असंभव है, संभवतः दिन या महीना गलत पढ़ा गया`,
            });
            dataErrors.push({
                english: "Second Appointment should be after First Appointment",
                hindi:   "दूसरी अपॉइंटमेंट पहली अपॉइंटमेंट के बाद होनी चाहिए",
            });
        }

        // Completed/Missed/Cancelled in a future year
        const terminalStatuses = ["Completed", "Missed", "Cancelled"];
        if (terminalStatuses.includes(firstStatus ?? "") && firstDate && firstDate.yy > currentYear) {
            rescanReasons.push({
                english: `First appointment is '${firstStatus}' but year ${firstDate.yy} is in the future — impossible`,
                hindi:   `पहली अपॉइंटमेंट '${firstStatus}' है लेकिन वर्ष ${firstDate.yy} भविष्य में है — यह असंभव है`,
            });
            dataErrors.push({
                english: `First appointment is marked as '${firstStatus}' but year ${firstDate.yy} is in the future — year appears to be misread`,
                hindi:   `पहली अपॉइंटमेंट '${firstStatus}' के रूप में चिह्नित है, लेकिन वर्ष ${firstDate.yy} भविष्य में है — वर्ष गलत पढ़ा गया लगता है`,
            });
        }

        // Year gap > 1
        if (firstDate && secondDate && Math.abs(secondDate.yy - firstDate.yy) > 1) {
            rescanReasons.push({
                english: `Year gap between first (${firstDate.yy}) and second attempt (${secondDate.yy}) is implausible`,
                hindi:   `पहली (${firstDate.yy}) और दूसरे प्रयास (${secondDate.yy}) के बीच वर्षों का अंतर अविश्वसनीय है`,
            });
        }

        // Both dates identical
        if (firstDate && secondDate &&
            firstDate.dd === secondDate.dd &&
            firstDate.mm === secondDate.mm &&
            firstDate.yy === secondDate.yy) {
            rescanReasons.push({
                english: `Both appointments have the same date (${fDateField!.answer}) — likely a duplicate misread`,
                hindi:   `दोनों अपॉइंटमेंट की एक ही तारीख है (${fDateField!.answer}) — संभवतः डुप्लीकेट गलत पठन`,
            });
        }

        // Status-paired checks (not applicable to completion-only pages like Page 36)
        if (hasStatusFields) {
            if (["Missed", "Cancelled"].includes(firstStatus ?? "") && !sDateField?.answer) {
                rescanReasons.push({
                    english: `First appointment is '${firstStatus}' but second attempt section appears empty — may have been overlooked`,
                    hindi:   `पहली अपॉइंटमेंट '${firstStatus}' है लेकिन दूसरे प्रयास का भाग खाली दिखता है — यह छूट गया हो सकता है`,
                });
            }

            if (firstStatus === "Completed" && sDateField?.answer) {
                rescanReasons.push({
                    english: "Second attempt data present but first appointment is 'Completed' — second attempt is only for Missed/Cancelled appointments",
                    hindi:   "दूसरे प्रयास का डेटा मौजूद है लेकिन पहली अपॉइंटमेंट 'पूर्ण' है — दूसरा प्रयास केवल छूटी/रद्द अपॉइंटमेंट के लिए है",
                });
            }

            if (!fDateField?.answer && fStatusField?.answer) {
                rescanReasons.push({
                    english: "First appointment status is filled but date could not be read",
                    hindi:   "पहली अपॉइंटमेंट की स्थिति भरी है लेकिन तारीख नहीं पढ़ी जा सकी",
                });
            }
            if (fDateField?.answer && !fStatusField?.answer) {
                rescanReasons.push({
                    english: "First appointment date is filled but status could not be read",
                    hindi:   "पहली अपॉइंटमेंट की तारीख भरी है लेकिन स्थिति नहीं पढ़ी जा सकी",
                });
            }

            // Future-date validation (only for true appointment pages)
            if (firstDate && firstStatus === "Scheduled" && toDate(firstDate) < today) {
                rescanReasons.push({
                    english: `First appointment is 'Scheduled' but date ${fDateField!.answer} is in the past — scheduled appointments must have a future date`,
                    hindi:   `पहली अपॉइंटमेंट 'निर्धारित' है लेकिन तारीख ${fDateField!.answer} भूतकाल में है — निर्धारित अपॉइंटमेंट की तारीख भविष्य में होनी चाहिए`,
                });
                dataErrors.push({
                    english: "Scheduled appointment date cannot be in the past",
                    hindi:   "निर्धारित अपॉइंटमेंट की तारीख भूतकाल में नहीं हो सकती",
                });
            }
            if (secondDate && sStatusField?.answer === "Scheduled" && toDate(secondDate) < today) {
                rescanReasons.push({
                    english: `Second appointment is 'Scheduled' but date ${sDateField!.answer} is in the past — scheduled appointments must have a future date`,
                    hindi:   `दूसरी अपॉइंटमेंट 'निर्धारित' है लेकिन तारीख ${sDateField!.answer} भूतकाल में है — निर्धारित अपॉइंटमेंट की तारीख भविष्य में होनी चाहिए`,
                });
                dataErrors.push({
                    english: "Second scheduled appointment date cannot be in the past",
                    hindi:   "दूसरी निर्धारित अपॉइंटमेंट की तारीख भूतकाल में नहीं हो सकती",
                });
            }
        }

        // Duplicate-date check against history
        if (historicalDates.length > 0) {
            const newDates = [fDateField?.answer, sDateField?.answer].filter((d): d is string => !!d);
            for (const d of newDates) {
                if (historicalDates.includes(d)) {
                    rescanReasons.push({
                        english: `Date ${d} was already recorded in a previous scan for this page — if this is the same appointment, no re-upload is needed; if it is a new appointment, please ensure a different date is marked`,
                        hindi:   `तारीख ${d} इस पृष्ठ के पिछले स्कैन में पहले से दर्ज है — यदि यह वही अपॉइंटमेंट है तो दोबारा अपलोड की आवश्यकता नहीं है; यदि यह नई अपॉइंटमेंट है तो कृपया एक अलग तारीख भरें`,
                    });
                }
            }
        }
    }

    // ── Merge image-quality warnings into rescan reasons ─────────────────
    const qualityPhrases = ["quality", "retake", "patterned", "blurry", "angle", "portrait orientation", "lighting", "cut off"];
    const qualityWarnings: BilingualMessage[] = processingWarnings
        .filter(w => qualityPhrases.some(phrase => w.toLowerCase().includes(phrase)))
        .map(qualityWarningToBilingual);

    const allRescanReasons: BilingualMessage[] = [...rescanReasons, ...qualityWarnings];

    // ── Final action ──────────────────────────────────────────────────────
    const rejectionRequired = rejectionReasons.length > 0;
    const rescanRequired    = allRescanReasons.length > 0;

    const action: ScanAction = rejectionRequired ? "rejected"
        : rescanRequired    ? "rescan_required"
        :                     "success";

    const userMessage = action === "rejected"
        ? "This scan could not be processed — the image is unreadable. Please retake it clearly and try again."
        : action === "rescan_required"
            ? "The photo could not be read accurately. Please retake it on a plain surface, held directly above the form, and try again."
            : "Data extracted successfully.";

    const dataError = dataErrors.length > 0
        ? {
            english: dataErrors.map(e => e.english).join("; "),
            hindi:   dataErrors.map(e => e.hindi).join("; "),
          }
        : null;

    return {
        action,
        rescanRequired,
        rescanReasons: allRescanReasons,
        rejectionRequired,
        rejectionReasons,
        dataError,
        alertMessage: action !== "success" ? "Rescan is required" : null,
        userMessage,
        dataReliable: action === "success" && dataError === null,
        overallConfidence,
    };
}
