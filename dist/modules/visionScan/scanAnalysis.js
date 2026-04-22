"use strict";
/**
 * Scan Analysis — rescan / rejection decision logic.
 *
 * Ported from cantrac-omr/src/services/vision-extraction.js
 * (_checkRescanRequired, data-error message block, action/userMessage logic).
 *
 * Works with the Digital-Diary-API's EnrichedResult shape:
 *   answer: string | null   (combined "DD/Mon/YYYY" for date fields)
 *   confidence: number      (0–1 numeric)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeScanAnalysis = void 0;
// ─── Helpers ──────────────────────────────────────────────────────────────
// Month names for DD/MMM/YYYY format. Numeric keys kept for backward compat with old records.
const MONTH_NUM = {
    "01": 1, "02": 2, "03": 3, "04": 4, "05": 5, "06": 6,
    "07": 7, "08": 8, "09": 9, "10": 10, "11": 11, "12": 12,
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};
/**
 * Parse combined date string.
 * Accepts "DD/MMM/YYYY" (e.g. "07/Apr/2026") — current format.
 * Also accepts legacy "DD/MM/YYYY" (e.g. "07/04/2026") for backward compat.
 * Returns null for any invalid / null input.
 */
function parseCombinedDate(val) {
    if (!val || typeof val !== "string")
        return null;
    const parts = val.split("/");
    if (parts.length !== 3)
        return null;
    const dd = parseInt(parts[0], 10);
    const mm = parts[1]; // "04" (new) or "Apr" (legacy)
    const yy = parseInt(parts[2], 10);
    const mmNum = MONTH_NUM[mm];
    if (isNaN(dd) || !mmNum || isNaN(yy) || dd < 1 || dd > 31)
        return null;
    return { dd, mm, mmNum, yy };
}
function toDate(p) {
    return new Date(p.yy, p.mmNum - 1, p.dd);
}
// ─── Main export ──────────────────────────────────────────────────────────
/**
 * Compute rescan / rejection analysis for a completed AI extraction.
 *
 * @param enrichedResults  Keyed by question ID, values from buildEnrichedResults()
 * @param questions        DiaryQuestion list for this page (from the DB)
 * @param processingWarnings  Warnings already collected during extraction
 */
function computeScanAnalysis(enrichedResults, questions, processingWarnings, historicalDates = [] // date strings already saved for this patient+page
) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // midnight
    const currentYear = now.getFullYear();
    const rescanReasons = [];
    const rejectionReasons = [];
    // ── Overall confidence ──────────────────────────────────────────────
    const scores = Object.values(enrichedResults).map(f => f.confidence);
    const overallConfidence = scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : 0;
    // ── General checks (all page types) ────────────────────────────────
    if (overallConfidence > 0 && overallConfidence < 0.65) {
        rescanReasons.push(`Overall confidence is ${overallConfidence} — extraction may be inaccurate`);
    }
    const lowConfFields = Object.entries(enrichedResults)
        .filter(([, f]) => f.confidence < 0.5 && f.answer !== null);
    if (lowConfFields.length >= 1) {
        rescanReasons.push(`${lowConfFields.length} field(s) have low confidence — verify manually`);
    }
    // ── Rejection: too little data to be useful ─────────────────────────
    const answerableFields = Object.values(enrichedResults)
        .filter((_, i) => questions[i]?.type !== "info");
    const nullFraction = answerableFields.length > 0
        ? answerableFields.filter(f => f.answer === null).length / answerableFields.length
        : 1;
    if (overallConfidence > 0 && overallConfidence < 0.35) {
        rejectionReasons.push(`Overall confidence is critically low (${overallConfidence}) — scan is unreliable`);
    }
    if (nullFraction > 0.7 && answerableFields.length > 0) {
        rejectionReasons.push(`More than 70% of fields could not be read — image is unreadable`);
    }
    // ── Schedule-page checks ────────────────────────────────────────────
    //
    // isSchedule  — page has at least one date or select field
    // hasStatusFields — page has a select/status field paired with the date
    //
    // Pages like Page 36 (NACT Completed) have a date field that records a
    // PAST completion event — no paired status field. Date/status cross-checks
    // and future-date validation must NOT apply to those pages.
    const isSchedule = questions.some(q => q.type === "date" || q.type === "select");
    const dataErrors = [];
    if (isSchedule) {
        // Identify first/second date and status fields by question type order
        const dateQs = questions.filter(q => q.type === "date");
        const statusQs = questions.filter(q => q.type === "select");
        const hasStatusFields = statusQs.length > 0;
        const firstDateId = dateQs[0]?.id;
        const secondDateId = dateQs[1]?.id;
        const firstStatusId = statusQs[0]?.id;
        const secondStatusId = statusQs[1]?.id;
        const fDateField = firstDateId ? enrichedResults[firstDateId] : undefined;
        const sDateField = secondDateId ? enrichedResults[secondDateId] : undefined;
        const fStatusField = firstStatusId ? enrichedResults[firstStatusId] : undefined;
        const sStatusField = secondStatusId ? enrichedResults[secondStatusId] : undefined;
        const firstDate = parseCombinedDate(fDateField?.answer ?? null);
        const secondDate = parseCombinedDate(sDateField?.answer ?? null);
        const firstStatus = fStatusField?.answer ?? null;
        // Low confidence on date/status fields
        if (fDateField && fDateField.confidence < 0.5 && fDateField.answer !== null)
            rescanReasons.push(`First appointment date has low confidence — value may be misread`);
        if (sDateField && sDateField.confidence < 0.5 && sDateField.answer !== null)
            rescanReasons.push(`Second attempt date has low confidence — value may be misread`);
        if (hasStatusFields && fStatusField && fStatusField.confidence < 0.5 && fStatusField.answer !== null)
            rescanReasons.push(`First appointment status has low confidence — value may be misread`);
        if (hasStatusFields && sStatusField && sStatusField.confidence < 0.5 && sStatusField.answer !== null)
            rescanReasons.push(`Second attempt status has low confidence — value may be misread`);
        // Chronological order: second attempt MUST be after first appointment
        if (firstDate && secondDate) {
            if (toDate(secondDate) <= toDate(firstDate)) {
                const msg = `Second attempt date (${sDateField.answer}) is before first appointment (${fDateField.answer}) — impossible, likely a DD or MM misread`;
                rescanReasons.push(msg);
                dataErrors.push("Second Appointment should be after First Appointment");
            }
        }
        // Completed / Missed / Cancelled in a future year → impossible
        const terminalStatuses = ["Completed", "Missed", "Cancelled"];
        if (terminalStatuses.includes(firstStatus ?? "") && firstDate && firstDate.yy > currentYear) {
            const msg = `First appointment is '${firstStatus}' but year ${firstDate.yy} is in the future — impossible`;
            rescanReasons.push(msg);
            dataErrors.push(`First appointment is marked as '${firstStatus}' but year ${firstDate.yy} is in the future — year appears to be misread`);
        }
        // Year gap > 1 between first and second attempt
        if (firstDate && secondDate && Math.abs(secondDate.yy - firstDate.yy) > 1) {
            rescanReasons.push(`Year gap between first (${firstDate.yy}) and second attempt (${secondDate.yy}) is implausible`);
        }
        // Both dates identical → model likely read the same row twice
        if (firstDate && secondDate &&
            firstDate.dd === secondDate.dd &&
            firstDate.mm === secondDate.mm &&
            firstDate.yy === secondDate.yy) {
            rescanReasons.push(`Both appointments have the same date (${fDateField.answer}) — likely a duplicate misread`);
        }
        // The following checks only make sense on pages that have a paired status
        // field (true appointment-schedule pages). Pages that only record a completion
        // date (e.g. Page 36 NACT Completed) must not be validated against these rules.
        if (hasStatusFields) {
            // Missed/Cancelled with no second-attempt data filled
            if (["Missed", "Cancelled"].includes(firstStatus ?? "") && !sDateField?.answer) {
                rescanReasons.push(`First appointment is '${firstStatus}' but second attempt section appears empty — may have been overlooked`);
            }
            // Second attempt present when first was Completed → contradictory
            if (firstStatus === "Completed" && sDateField?.answer) {
                rescanReasons.push(`Second attempt data present but first appointment is 'Completed' — second attempt is only for Missed/Cancelled appointments`);
            }
            // Date and status must both be present or both absent
            if (!fDateField?.answer && fStatusField?.answer)
                rescanReasons.push(`First appointment status is filled but date could not be read`);
            if (fDateField?.answer && !fStatusField?.answer)
                rescanReasons.push(`First appointment date is filled but status could not be read`);
            // ── Future-date validation ─────────────────────────────────────
            // Only applies to pages with a status field — completion-date pages
            // (e.g. Page 36) record past events and must never be flagged here.
            if (firstDate && firstStatus === "Scheduled" && toDate(firstDate) < today) {
                rescanReasons.push(`First appointment is 'Scheduled' but date ${fDateField.answer} is in the past — scheduled appointments must have a future date`);
                dataErrors.push("Scheduled appointment date cannot be in the past");
            }
            if (secondDate && sStatusField?.answer === "Scheduled" && toDate(secondDate) < today) {
                rescanReasons.push(`Second appointment is 'Scheduled' but date ${sDateField.answer} is in the past — scheduled appointments must have a future date`);
                dataErrors.push("Second scheduled appointment date cannot be in the past");
            }
        }
        // ── Duplicate-date check against history ───────────────────────────
        // If this page has been scanned before, the new dates must be different
        // from what's already recorded — otherwise it's likely a duplicate upload.
        if (historicalDates.length > 0) {
            const newDates = [fDateField?.answer, sDateField?.answer]
                .filter((d) => !!d);
            for (const d of newDates) {
                if (historicalDates.includes(d)) {
                    rescanReasons.push(`Date ${d} was already recorded in a previous scan for this page — if this is the same appointment, no re-upload is needed; if it is a new appointment, please ensure a different date is marked`);
                }
            }
        }
    }
    // ── Merge image-quality warnings into rescan reasons ─────────────────
    const qualityPhrases = ["quality", "retake", "patterned", "blurry", "angle", "portrait orientation", "lighting", "cut off"];
    const qualityWarnings = processingWarnings
        .filter(w => qualityPhrases.some(phrase => w.toLowerCase().includes(phrase)))
        .map(w => `Photo: ${w}`);
    const allRescanReasons = [...rescanReasons, ...qualityWarnings];
    // ── Determine final action ────────────────────────────────────────────
    const rejectionRequired = rejectionReasons.length > 0;
    const rescanRequired = allRescanReasons.length > 0;
    const action = rejectionRequired
        ? "rejected"
        : rescanRequired
            ? "rescan_required"
            : "success";
    const userMessage = action === "rejected"
        ? "This scan could not be processed — the image is unreadable. Please retake it clearly and try again."
        : action === "rescan_required"
            ? "The photo could not be read accurately. Please retake it on a plain surface, held directly above the form, and try again."
            : "Data extracted successfully.";
    const dataError = dataErrors.length > 0 ? dataErrors.join("; ") : null;
    const alertMessage = action !== "success" ? "Rescan is required" : null;
    const dataReliable = action === "success" && dataError === null;
    return {
        action,
        rescanRequired,
        rescanReasons: allRescanReasons,
        rejectionRequired,
        rejectionReasons,
        dataError,
        alertMessage,
        userMessage,
        dataReliable,
        overallConfidence,
    };
}
exports.computeScanAnalysis = computeScanAnalysis;
