"use strict";
/**
 * Anthropic Claude Vision Extraction Service
 *
 * Ported and enhanced from cantrac-omr/src/services/vision-extraction.js
 *
 * Key improvements over the previous version:
 *   - Prompt caching (cache_control: ephemeral) — retries cost ~10% of normal price
 *   - Claude Haiku for cheap image-quality + form-validity checks
 *   - Granular DD / MM / YY component retries (separate focused prompts per component)
 *   - Near-end DD bias correction (positions 14-16, 26-31 prone to off-by-1)
 *   - Combined DD+MM retry in a single API call when both components are bad
 *   - Combined YY retry for both sections in one API call
 *   - Cross-validation: same-month misread, future-year for terminal statuses
 *   - Image quality assessment via Haiku
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAnthropicConfigured = exports.extractWithAnthropic = void 0;
const sharp_1 = __importDefault(require("sharp"));
// ─── Config ────────────────────────────────────────────────────────────────
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 4096;
const ANTHROPIC_TIMEOUT_MS = 60000;
const STD_MAX_DIM = 1600;
const STD_QUALITY = 85;
const SCHED_MAX_DIM = 2400; // cantrac-omr: 2400px @ 90% — ~30% fewer tokens than 3000px @ 95%
const SCHED_QUALITY = 90;
const LOWRES_MAX = 800;
const LOWRES_QUAL = 70;
const CONFIDENCE_MAP = { high: 0.95, medium: 0.75, low: 0.45 };
const MONTH_TO_NUM = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};
const VALID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const VALID_YEARS = ["2026", "2027", "2028"];
// ─── Image Preprocessing (unchanged — already matches cantrac-omr exactly) ─
async function pinkAtTop(buf) {
    const m = await (0, sharp_1.default)(buf).metadata();
    if (!m.width || !m.height)
        return 0;
    const h = Math.floor(m.height * 0.12);
    const { data, info } = await (0, sharp_1.default)(buf)
        .extract({ left: 0, top: 0, width: m.width, height: h })
        .resize(80, undefined).raw().toBuffer({ resolveWithObject: true });
    let n = 0;
    for (let i = 0; i < data.length; i += info.channels)
        if (data[i] > 160 && data[i + 1] < 140 && data[i + 2] < 160)
            n++;
    return n / (data.length / info.channels);
}
async function cropToForm(buffer, meta, skipAspectGuard = false) {
    const ANALYSIS_SIZE = 300;
    const DENSITY = 0.30;
    const EDGE_DENSITY = 0.05;
    const PADDING = 20;
    const { data, info } = await (0, sharp_1.default)(buffer).grayscale().normalize()
        .resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
    const mWidth = meta.width || info.width;
    const mHeight = meta.height || info.height;
    const scaleX = mWidth / info.width;
    const scaleY = mHeight / info.height;
    const sorted = Buffer.from(data).sort();
    const threshold = Math.max(180, sorted[Math.floor(sorted.length * 0.80)] - 20);
    const colWhite = new Float32Array(info.width);
    const rowWhite = new Float32Array(info.height);
    for (let r = 0; r < info.height; r++)
        for (let c = 0; c < info.width; c++)
            if (data[r * info.width + c] >= threshold) {
                colWhite[c] += 1 / info.height;
                rowWhite[r] += 1 / info.width;
            }
    let minCol = 0, maxCol = info.width - 1, minRow = 0, maxRow = info.height - 1;
    for (let c = 0; c < info.width; c++)
        if (colWhite[c] >= DENSITY) {
            minCol = c;
            break;
        }
    for (let c = info.width - 1; c >= 0; c--)
        if (colWhite[c] >= EDGE_DENSITY) {
            maxCol = c;
            break;
        }
    for (let r = 0; r < info.height; r++)
        if (rowWhite[r] >= DENSITY) {
            minRow = r;
            break;
        }
    for (let r = info.height - 1; r >= 0; r--)
        if (rowWhite[r] >= EDGE_DENSITY) {
            maxRow = r;
            break;
        }
    minCol = Math.max(0, minCol - PADDING);
    maxCol = Math.min(info.width - 1, maxCol + PADDING);
    minRow = Math.max(0, minRow - PADDING);
    maxRow = Math.min(info.height - 1, maxRow + PADDING);
    const cropFrac = 1 - ((maxRow - minRow) * (maxCol - minCol)) / (info.height * info.width);
    if (cropFrac < 0.30) {
        console.log("[Preprocessor] Background too small — skipping crop");
        return buffer;
    }
    const left = Math.max(0, Math.floor(minCol * scaleX));
    const top = Math.max(0, Math.floor(minRow * scaleY));
    const right = Math.min(mWidth, Math.ceil(maxCol * scaleX));
    const bottom = Math.min(mHeight, Math.ceil(maxRow * scaleY));
    const width = right - left;
    const height = bottom - top;
    if (!skipAspectGuard) {
        const oA = mWidth / mHeight;
        const cA = width / height;
        if (oA > 1 && Math.max(oA, cA) / Math.min(oA, cA) > 1.5) {
            console.log("[Preprocessor] Crop would distort landscape aspect — skipping");
            return buffer;
        }
    }
    console.log(`[Preprocessor] Cropping to form: ${left},${top} → ${width}×${height} (was ${mWidth}×${mHeight})`);
    return (0, sharp_1.default)(buffer).extract({ left, top, width, height }).toBuffer();
}
async function preprocessForVision(imageBuffer, maxDimension = STD_MAX_DIM, quality = STD_QUALITY) {
    let rotatedBuffer = await (0, sharp_1.default)(imageBuffer).rotate().toBuffer();
    let rotatedMeta = await (0, sharp_1.default)(rotatedBuffer).metadata();
    let wasPortrait = false;
    if (rotatedMeta.height && rotatedMeta.width && rotatedMeta.height > rotatedMeta.width) {
        wasPortrait = true;
        const cw90 = await (0, sharp_1.default)(rotatedBuffer).rotate(90).toBuffer();
        const cw270 = await (0, sharp_1.default)(rotatedBuffer).rotate(270).toBuffer();
        const [pink90, pink270] = await Promise.all([pinkAtTop(cw90), pinkAtTop(cw270)]);
        rotatedBuffer = pink270 > pink90 ? cw270 : cw90;
        console.log(`[Preprocessor] Portrait → ${pink270 > pink90 ? "270°" : "90°"} CW (pink90=${pink90.toFixed(3)} pink270=${pink270.toFixed(3)})`);
        rotatedMeta = await (0, sharp_1.default)(rotatedBuffer).metadata();
    }
    if (wasPortrait && rotatedMeta.width && rotatedMeta.height && rotatedMeta.width > rotatedMeta.height) {
        const prelim = await cropToForm(rotatedBuffer, rotatedMeta, true);
        const pMeta = await (0, sharp_1.default)(prelim).metadata();
        if (pMeta.width && pMeta.height && pMeta.width / pMeta.height < 1.15) {
            rotatedBuffer = await (0, sharp_1.default)(rotatedBuffer).rotate(90).toBuffer();
            rotatedMeta = await (0, sharp_1.default)(rotatedBuffer).metadata();
            console.log("[Preprocessor] Form portrait-shaped in landscape frame — rotating +90°");
        }
    }
    rotatedBuffer = await cropToForm(rotatedBuffer, rotatedMeta);
    rotatedMeta = await (0, sharp_1.default)(rotatedBuffer).metadata();
    return (0, sharp_1.default)(rotatedBuffer)
        .resize(maxDimension, maxDimension, { fit: "inside", withoutEnlargement: true })
        .normalize().sharpen({ sigma: 1.0 }).jpeg({ quality }).toBuffer();
}
// ─── Prompt Building ──────────────────────────────────────────────────────
function buildSystemPrompt() {
    return `You are a medical OCR specialist for the CANTrac breast cancer diary.
Your job is to examine photos of diary pages and extract which bubbles are filled.

CRITICAL RULES:
1. FILLED bubble: interior is COMPLETELY SOLID dark (blue/purple ink, no light center visible). EMPTY bubble: thin ring outline only, white/light interior — the vast majority of bubbles look like this. Exactly ONE bubble per row is filled (zero if unanswered). If two look similarly dark, pick the darker one and set confidence "medium". Never mistake printed border lines or box edges for bubbles.
2. Return ONLY valid JSON — no markdown, no backticks, no explanation.
3. If a bubble appears partially filled or ambiguous, mark it as filled and set confidence to "low".
4. If you cannot determine a field at all (image too blurry, cut off), set value to null.
5. For Yes/No fields: return "Yes" or "No" (or null if unreadable).
6. For status fields: return one of the exact option strings.
7. The page number is printed at the top center of every page.
8. Photos may be taken at an angle, rotated sideways, or on a textured background — mentally rotate the image if needed. Focus on the white paper area.
9. DATE ROWS (DD/MM/YY): rows of small bubbles numbered 01-31, or labeled Jan-Dec, or 2026/2027/2028. Exactly ONE per row is filled. DD values must be zero-padded: "01", "05", "14", "31".`;
}
function buildExtractionPrompt(pageNumber, pageTitle, questions) {
    const isSchedule = questions.some(q => q.type === "date" || q.type === "select");
    if (isSchedule)
        return buildSchedulePrompt(pageNumber, pageTitle);
    const fieldLines = questions.filter(q => q.type !== "info").map((q, i) => {
        if (q.type === "yes_no")
            return `  ${i + 1}. "${q.id}" (yes_no): "${q.text}" → options: [Yes | No]`;
        if (q.type === "text")
            return `  ${i + 1}. "${q.id}" (text): "${q.text}" → read handwritten text or ""`;
        const opts = q.options?.join(" | ") || "Yes | No";
        return `  ${i + 1}. "${q.id}" (${q.type}): "${q.text}" → options: [${opts}]`;
    }).join("\n");
    const exampleFields = questions.filter(q => q.type !== "info")
        .map(q => `    "${q.id}": { "value": <extracted_value_or_null>, "confidence": "high"|"medium"|"low" }`).join(",\n");
    return `This is CANTrac page ${pageNumber}: "${pageTitle}"
Extract the value of each field by examining which bubble is filled next to each question.
Fields to extract:\n${fieldLines}
Respond with ONLY this JSON (no markdown, no backticks):
{\n  "pageNumber": ${pageNumber},\n  "title": "${pageTitle}",\n  "fields": {\n${exampleFields}\n  }\n}`;
}
function buildSchedulePrompt(pageNumber, pageTitle) {
    return `CANTrac page ${pageNumber}: "${pageTitle}" — SCHEDULE PAGE.

Read TWO sections (First Appointment at the top, Second Attempt at the bottom). For each section extract:

1. DD row: TWO lines — Line 1 has 16 bubbles (days 01-16), Line 2 has 15 bubbles (days 17-31).
   Count N empty left + R empty right of the filled bubble.
   Line 1: day=N+1, verify N+R+1=16. Line 2: day=N+17, verify N+R+1=15.
   Near-end (N≥13): count from BOTH sides and confirm both agree.
   Always return a value; zero-pad: "01", "15", "31". Return null only if the section is entirely blank.
2. MM row: 12 bubbles — Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec. Count N empty left of filled → N=0→Jan…N=11→Dec. The LAST bubble (Dec, rightmost) is easy to miss.
3. YY row: LEFTMOST=2026, MIDDLE=2027, RIGHTMOST=2028. Assess each bubble individually — which one is solid dark?
4. Status: Scheduled / Completed / Missed / Cancelled.

The Second Attempt section may be completely blank if no second appointment was needed.
Also read "Next Appointment Required" (Yes/No) at the very bottom of the page.

Reasoning must show your count in compact form (e.g. "L1:N=4,R=11,sum=16→05"):
{
  "pageNumber": ${pageNumber},
  "pageType": "schedule",
  "title": "${pageTitle}",
  "reasoning": {
    "first_dd": "<L1:N=?,R=?,sum=?→DD  or  L2:N=?,R=?,sum=?→DD>",
    "first_mm": "<N=?→Mon>",
    "first_yy": "<2026/2027/2028 — which is solid>",
    "first_status": "<which bubble is solid>",
    "second_dd": "<same format or blank>",
    "second_mm": "<N=?→Mon or blank>",
    "second_yy": "<which is solid or blank>",
    "second_status": "<which or blank>"
  },
  "fields": {
    "first_appointment_dd":     { "value": "<01-31 or null>", "confidence": "high|medium|low" },
    "first_appointment_mm":     { "value": "<Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec or null>", "confidence": "high|medium|low" },
    "first_appointment_yy":     { "value": "<2026|2027|2028 or null>", "confidence": "high|medium|low" },
    "first_appointment_status": { "value": "<Scheduled|Completed|Missed|Cancelled or null>", "confidence": "high|medium|low" },
    "second_attempt_dd":        { "value": "<01-31 or null>", "confidence": "high|medium|low" },
    "second_attempt_mm":        { "value": "<Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec or null>", "confidence": "high|medium|low" },
    "second_attempt_yy":        { "value": "<2026|2027|2028 or null>", "confidence": "high|medium|low" },
    "second_attempt_status":    { "value": "<Scheduled|Completed|Missed|Cancelled or null>", "confidence": "high|medium|low" },
    "next_appointment_required": { "value": "<Yes|No or null>", "confidence": "high|medium|low" }
  }
}`;
}
async function callAnthropic(base64Image, userPrompt, apiKey, opts = {}) {
    const model = opts.model || ANTHROPIC_MODEL;
    const maxTokens = opts.maxTokens || MAX_TOKENS;
    const body = {
        model,
        max_tokens: maxTokens,
        system: [{ type: "text", text: buildSystemPrompt(), cache_control: { type: "ephemeral" } }],
        messages: [{
                role: "user",
                content: [
                    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Image },
                        cache_control: { type: "ephemeral" } },
                    { type: "text", text: userPrompt },
                ],
            }],
    };
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), ANTHROPIC_TIMEOUT_MS);
    let response;
    try {
        response = await fetch(ANTHROPIC_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-beta": "prompt-caching-2024-07-31",
            },
            body: JSON.stringify(body),
            signal: abort.signal,
        });
    }
    catch (err) {
        clearTimeout(timer);
        if (err.name === "AbortError")
            throw new Error("Anthropic API timed out after 60 s");
        throw new Error(`Anthropic API network error: ${err.message}`);
    }
    clearTimeout(timer);
    if (!response.ok) {
        const errText = await response.text();
        if (response.status === 401)
            throw new Error("Anthropic API: invalid API key — set ANTHROPIC_API_KEY in .env");
        if (response.status === 429)
            throw new Error("Anthropic API: rate limit exceeded");
        throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }
    const data = await response.json();
    // Log cache hits (visible in server logs for cost tracking)
    if (data.usage?.cache_read_input_tokens > 0)
        console.log(`[Anthropic] Cache hit: ${data.usage.cache_read_input_tokens} tokens (~$${((data.usage.cache_read_input_tokens / 1000000) * 0.30).toFixed(4)} saved)`);
    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("").trim();
    if (!text)
        throw new Error("Anthropic API returned empty response");
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    const fixed = cleaned.replace(/:\s*0+(\d+)/g, ": $1"); // fix bare leading zeros in JSON numbers
    try {
        return JSON.parse(fixed);
    }
    catch {
        throw new Error(`Failed to parse Anthropic response: ${cleaned.substring(0, 400)}`);
    }
}
// Haiku caller — for cheap utility checks (image quality, form validity)
async function callHaiku(base64Image, userPrompt, apiKey) {
    return callAnthropic(base64Image, userPrompt, apiKey, { model: HAIKU_MODEL, maxTokens: 512 });
}
// ─── Schedule: Helper to parse DD/MM/YY components from existing field map ─
function parseDateComponents(fields, prefix) {
    return {
        dd: fields[`${prefix}_dd`]?.value ?? null,
        mm: fields[`${prefix}_mm`]?.value ?? null,
        yy: fields[`${prefix}_yy`]?.value ?? null,
        status: fields[`${prefix}_status`]?.value ?? null,
        ddConf: fields[`${prefix}_dd`]?.confidence ?? null,
        mmConf: fields[`${prefix}_mm`]?.confidence ?? null,
        yyConf: fields[`${prefix}_yy`]?.confidence ?? null,
    };
}
function assembleDateString(dd, mm, yy) {
    if (!dd || !mm || !yy)
        return null;
    const mmNum = /^\d{2}$/.test(mm) ? mm : MONTH_TO_NUM[mm.toLowerCase()];
    if (!mmNum)
        return null;
    return `${dd.padStart(2, "0")}/${mmNum}/${yy}`;
}
// ─── Schedule: Component-level Retry Prompts (ported from cantrac-omr) ───
function buildDDMMRetryPrompt(sectionLabel) {
    return `Look at this CANTrac diary page. Focus ONLY on the "${sectionLabel}" section.

Read BOTH rows:

DD row — TWO lines: Line 1 has 16 bubbles (days 01-16), Line 2 has 15 bubbles (days 17-31).
Count N empty left + R empty right of the filled bubble.
Line 1: day=N+1, verify N+R+1=16. Line 2: day=N+17, verify N+R+1=15. Zero-pad result.

MM row — 12 bubbles: Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec.
Count N empty left of filled → N=0→Jan … N=11→Dec.
Pay close attention to the last 3 (Oct, Nov, Dec) — easy to miss near the right edge.

Respond with ONLY this JSON (no markdown, no backticks):
{ "dd": "<01-31>", "dd_confidence": "high|medium|low", "mm": "<Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|null>", "mm_confidence": "high|medium|low" }`;
}
function buildDDRetryPrompt(sectionLabel, ddValue, ddPlus1Str) {
    if (ddValue && ddPlus1Str) {
        return `Look at this CANTrac diary page. Focus ONLY on the "${sectionLabel}" section.
Compare ONLY these two adjacent DD bubbles: day ${ddValue} and day ${ddPlus1Str}.
Which of the two is DARKER (solid ink, no light center)?
Respond with ONLY this JSON (no markdown, no backticks):
{ "dd": "<${ddValue}|${ddPlus1Str}>", "confidence": "high|medium|low" }`;
    }
    return `Look at this CANTrac diary page. Focus ONLY on the "${sectionLabel}" section.
DD row — TWO lines: Line 1 has 16 bubbles (days 01-16), Line 2 has 15 bubbles (days 17-31).
Count N empty left + R empty right of the filled bubble.
Line 1: day=N+1, verify N+R+1=16. Line 2: day=N+17, verify N+R+1=15.
Always return a value; return null only if every bubble in both lines is clearly empty.
Respond with ONLY this JSON (no markdown, no backticks):
{ "dd": "<01-31>", "confidence": "high|medium|low" }`;
}
function buildMMRetryPrompt(sectionLabel, hasOtherData) {
    return `Look at this CANTrac diary page. Focus ONLY on the "${sectionLabel}" section.
Find the MM (month) row — 12 bubbles: Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec.
STEP 1 — Count N empty bubbles to the LEFT of the filled bubble: N=0→Jan … N=11→Dec.
STEP 2 — If counting is unclear, identify the month by its printed label next to the filled bubble.
Pay close attention to the last 3 positions (Oct, Nov, Dec) — easy to miss near the right edge.${hasOtherData ? "\nOther fields in this section are filled, so a month IS selected here." : ""}
Return null only if the entire section appears completely blank.
Respond with ONLY this JSON (no markdown, no backticks):
{ "mm": "<Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|null>", "confidence": "high|medium|low" }`;
}
function buildYYBothRetryPrompt() {
    return `Look at the YEAR rows in BOTH appointment sections on this CANTrac schedule page.
Each YY row has exactly THREE bubbles: LEFTMOST=2026, MIDDLE=2027, RIGHTMOST=2028.
ONE bubble per row is SOLID dark (ink fills the circle — no light center). Others are ring outlines.
WARNING: The leftmost (2026) and rightmost (2028) are easy to confuse — examine each position separately.

FIRST APPOINTMENT section (TOP section, above the divider):
- Is position 1 (LEFTMOST, 2026) solid dark?
- Is position 2 (MIDDLE, 2027) solid dark?
- Is position 3 (RIGHTMOST, 2028) solid dark?

SECOND ATTEMPT section (BOTTOM section, below the divider):
- Same — which of the 3 positions is solid dark?
- Return null if the entire second section appears blank.

Respond with ONLY this JSON (no markdown, no backticks):
{
  "first_yy": "<2026|2027|2028>",   "first_yy_confidence": "<high|medium|low>",
  "second_yy": "<2026|2027|2028|null>", "second_yy_confidence": "<high|medium|low>"
}`;
}
function buildYYSingleRetryPrompt(sectionLabel) {
    return `Look at the YEAR row in the "${sectionLabel}" section of this CANTrac schedule page.
The YY row has exactly THREE bubbles in order, left to right:
  Position 1 — LEFTMOST  = 2026
  Position 2 — MIDDLE    = 2027
  Position 3 — RIGHTMOST = 2028
ONE bubble is SOLID dark (ink fills the entire circle, no light center visible). The other two are ring outlines.
WARNING: The leftmost (2026) and rightmost (2028) sit at opposite ends and are easy to confuse. Examine each SEPARATELY:
- Is the LEFTMOST circle (2026) solid dark, or just an outline?
- Is the MIDDLE circle (2027) solid dark, or just an outline?
- Is the RIGHTMOST circle (2028) solid dark, or just an outline?
Respond with ONLY this JSON (no markdown, no backticks):
{ "yy": "<2026|2027|2028>", "confidence": "high|medium|low" }`;
}
function buildSecondSectionRetryPrompt(firstDD, firstMM, firstYY) {
    return `Look at this CANTrac diary page. Re-read ONLY the SECOND ATTEMPT (bottom) section.

First appointment: ${firstMM} ${firstDD}, ${firstYY}. Expect second attempt year to be ${firstYY} (or at most ${parseInt(firstYY) + 1}).

Read each row for the SECOND ATTEMPT section only:
- DD: Scan Line 2 (days 17-31, 15 bubbles) first, then Line 1 (days 01-16, 16 bubbles) if Line 2 is empty. Count N empty left → day=N+17 (Line 2) or N+1 (Line 1).
- MM: 12 bubbles Jan-Dec. Count N empty left → N=0→Jan … N=11→Dec.
- YY: LEFTMOST=2026, MIDDLE=2027, RIGHTMOST=2028. Expect ${firstYY}.
- Status: Scheduled / Completed / Missed / Cancelled.

If the entire section is blank, return null for all fields.

Respond with ONLY this JSON (no markdown, no backticks):
{
  "second_attempt_dd":     { "value": "<01-31 or null>",                                           "confidence": "high|medium|low" },
  "second_attempt_mm":     { "value": "<Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec or null>", "confidence": "high|medium|low" },
  "second_attempt_yy":     { "value": "<2026|2027|2028 or null>",                                  "confidence": "high|medium|low" },
  "second_attempt_status": { "value": "<Scheduled|Completed|Missed|Cancelled or null>",            "confidence": "high|medium|low" }
}`;
}
// ─── Cross-validation (ported from cantrac-omr._crossValidateScheduleFields) ─
async function crossValidateSchedule(base64Image, fields, apiKey, warnings) {
    const currentYear = new Date().getFullYear();
    const fMM = fields["first_appointment_mm"]?.value ?? null;
    const fYY = fields["first_appointment_yy"]?.value ?? null;
    const sMM = fields["second_attempt_mm"]?.value ?? null;
    const sYY = fields["second_attempt_yy"]?.value ?? null;
    const fSts = fields["first_appointment_status"]?.value ?? null;
    const issues = [];
    if (["Completed", "Missed", "Cancelled"].includes(fSts ?? "") && fYY && parseInt(fYY) > currentYear)
        issues.push("first_yy_future");
    if (fMM && sMM && fMM === sMM)
        issues.push("same_mm");
    if (fYY && sYY && fYY === sYY && ["Completed", "Missed", "Cancelled"].includes(fSts ?? ""))
        issues.push("same_yy_terminal");
    if (issues.length === 0)
        return false;
    console.log(`[Anthropic] Cross-validation issues: ${issues.join(", ")} — re-reading MM+YY`);
    const suspiciousNotes = [];
    if (issues.includes("first_yy_future"))
        suspiciousNotes.push(`ERROR: First appointment status is '${fSts}' with year ${fYY}. A ${fSts?.toLowerCase()} appointment MUST have already happened — year ${fYY} is STILL IN THE FUTURE (current: ${currentYear}). The LEFTMOST year bubble (2026) is almost certainly correct.`);
    if (issues.includes("same_mm"))
        suspiciousNotes.push(`ERROR: Both sections show the same month (${fMM}). Two appointments almost never share the same month — the model likely read the same MM bubble for both sections.`);
    if (issues.includes("same_yy_terminal") && !issues.includes("first_yy_future"))
        suspiciousNotes.push(`ERROR: Both sections show the same year (${fYY}) when first status is '${fSts}'. Read each section's YY row independently.`);
    const cvPrompt = `Look at this CANTrac schedule page carefully.

KNOWN EXTRACTION ERRORS — you must correct them:
${suspiciousNotes.join("\n\n")}

Re-read ONLY these 4 values. Read TOP and BOTTOM section rows COMPLETELY INDEPENDENTLY.

FIRST APPOINTMENT (TOP section, above the divider):
- MM row: 12 bubbles — Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec. Which ONE is SOLID dark?
- YY row: THREE bubbles. LEFTMOST=2026, MIDDLE=2027, RIGHTMOST=2028. Which ONE is solid dark?

SECOND ATTEMPT (BOTTOM section, below the divider):
- MM row: Look at the BOTTOM section's OWN separate row of 12 month bubbles. Which ONE is solid dark? (null if completely empty)
- YY row: Look at the BOTTOM section's OWN separate year row. Which is solid dark? (null if empty)

Respond with ONLY this JSON (no markdown, no backticks):
{
  "reasoning": {
    "first_mm":  "<describe what you see in the TOP section MM row>",
    "first_yy":  "<describe each of the 3 year bubbles in the TOP section>",
    "second_mm": "<describe what you see in the BOTTOM section MM row — reading independently>",
    "second_yy": "<describe the 3 year bubbles in the BOTTOM section>"
  },
  "first_mm":  "<Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec or null>",
  "first_yy":  "<2026|2027|2028 or null>",
  "second_mm": "<Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec or null>",
  "second_yy": "<2026|2027|2028 or null>"
}`;
    try {
        const correction = await callAnthropic(base64Image, cvPrompt, apiKey);
        if (correction.reasoning) {
            console.log("[Anthropic] Cross-validation reasoning:", JSON.stringify(correction.reasoning, null, 2));
        }
        const applied = [];
        if (correction.first_mm && VALID_MONTHS.includes(correction.first_mm) && correction.first_mm !== fMM) {
            fields["first_appointment_mm"] = { value: correction.first_mm, confidence: "medium" };
            applied.push(`first_mm=${correction.first_mm}`);
        }
        if (correction.first_yy && VALID_YEARS.includes(String(correction.first_yy))) {
            const corrYY = String(correction.first_yy);
            const fixesFuture = parseInt(corrYY) <= currentYear && parseInt(fYY || "0") > currentYear;
            if (corrYY !== fYY && (fixesFuture || issues.includes("same_yy_terminal"))) {
                fields["first_appointment_yy"] = { value: corrYY, confidence: "medium" };
                applied.push(`first_yy=${corrYY}`);
            }
        }
        if (correction.second_mm && VALID_MONTHS.includes(correction.second_mm) && correction.second_mm !== sMM) {
            fields["second_attempt_mm"] = { value: correction.second_mm, confidence: "medium" };
            applied.push(`second_mm=${correction.second_mm}`);
        }
        if (correction.second_yy && VALID_YEARS.includes(String(correction.second_yy)) && String(correction.second_yy) !== sYY) {
            fields["second_attempt_yy"] = { value: String(correction.second_yy), confidence: "medium" };
            applied.push(`second_yy=${correction.second_yy}`);
        }
        if (applied.length > 0)
            warnings.push(`Cross-validation corrected: ${applied.join(", ")}`);
        else
            warnings.push("Cross-validation re-read did not change values — manual verification recommended");
    }
    catch (err) {
        console.log(`[Anthropic] Cross-validation failed: ${err.message}`);
    }
    return true;
}
// ─── Image Quality + Form Validity (via Haiku) ────────────────────────────
async function assessImageQuality(lowResBase64, apiKey, warnings) {
    const prompt = `Look at this photo of a CANTrac diary page and assess its photographic quality.
Check for: patterned/textured background, severe angle/skew, blur/out-of-focus, poor lighting/glare, form edges cut off.
Respond with ONLY this JSON (no markdown):
{ "patterned_background": true|false, "severe_angle": true|false, "blurry": true|false, "poor_lighting": true|false, "form_cut_off": true|false, "overall_quality": "good"|"acceptable"|"poor" }`;
    try {
        const q = await callHaiku(lowResBase64, prompt, apiKey);
        const issues = [];
        if (q.patterned_background)
            issues.push("diary page on a patterned background — use a plain surface");
        if (q.severe_angle)
            issues.push("diary page at a severe angle — hold camera directly above");
        if (q.blurry)
            issues.push("image is blurry — hold steady and let it focus");
        if (q.poor_lighting)
            issues.push("poor lighting or glare — improve lighting");
        if (q.form_cut_off)
            issues.push("diary page edges cut off — ensure the whole page is in frame");
        if (issues.length > 0) {
            warnings.push("Image quality issues: " + issues.join("; ") + " — retake recommended");
            console.log(`[Anthropic] Image quality issues: ${issues.join(", ")}`);
        }
        if (q.overall_quality === "poor")
            warnings.push("Overall image quality is poor — retake the photo");
    }
    catch (err) {
        console.log(`[Anthropic] Quality check failed: ${err.message}`);
    }
}
async function checkFormValidity(lowResBase64, apiKey) {
    const prompt = `Is this a CANTrac breast cancer tracking diary page?
A valid CANTrac page has ALL of these: pink/red header banner, rows of bubble/circle options, page number at top center, breast cancer ribbon symbol, QR code.
Respond with ONLY this JSON (no markdown):
{ "isValid": true|false, "reason": "<one sentence>" }`;
    try {
        const result = await callHaiku(lowResBase64, prompt, apiKey);
        if (typeof result.isValid === "boolean")
            return { valid: result.isValid, reason: result.reason };
    }
    catch (err) {
        console.log(`[Anthropic] Form validity check failed: ${err.message}`);
    }
    return { valid: true }; // default to valid if check fails — don't block extraction
}
// ─── Main Export ──────────────────────────────────────────────────────────
async function extractWithAnthropic(imageBuffer, pageNumber, pageTitle, questions) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
        throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
    const startTime = Date.now();
    const warnings = [];
    const isSchedule = questions.some(q => q.type === "date" || q.type === "select");
    // Preprocess — standard vs high-res for schedule pages
    const [processedBuffer, lowResBuffer] = await Promise.all([
        preprocessForVision(imageBuffer, isSchedule ? SCHED_MAX_DIM : STD_MAX_DIM, isSchedule ? SCHED_QUALITY : STD_QUALITY),
        preprocessForVision(imageBuffer, LOWRES_MAX, LOWRES_QUAL),
    ]);
    const base64Image = processedBuffer.toString("base64");
    const lowResBase64 = lowResBuffer.toString("base64");
    // Validity check — cheap Haiku call to avoid wasting Sonnet on non-diary images
    const { valid: isValidForm, reason: invalidReason } = await checkFormValidity(lowResBase64, apiKey);
    if (!isValidForm) {
        warnings.push(`Image may not be a valid CANTrac diary page: ${invalidReason || "unknown reason"}`);
        console.log(`[Anthropic] Form validity: INVALID — ${invalidReason}`);
    }
    // Main extraction
    const rawResult = await callAnthropic(base64Image, buildExtractionPrompt(pageNumber, pageTitle, questions), apiKey);
    if (rawResult.reasoning) {
        console.log("[Anthropic] Reasoning:", JSON.stringify(rawResult.reasoning, null, 2));
        delete rawResult.reasoning;
    }
    // ── Schedule: component-level retries (DD / MM / YY separately) ──────
    let crossValidationFired = false;
    let secondRetryChanged = false;
    if (isSchedule && rawResult.fields) {
        const SECTIONS = [
            { prefix: "first_appointment", label: "First Appointment" },
            { prefix: "second_attempt", label: "Second Attempt (If First Missed/Cancelled)" },
        ];
        const nearEndRetryApplied = new Set();
        for (const { prefix, label } of SECTIONS) {
            const ddKey = `${prefix}_dd`;
            const mmKey = `${prefix}_mm`;
            const ddF = rawResult.fields[ddKey];
            const mmF = rawResult.fields[mmKey];
            const ddVal = parseInt(ddF?.value || "0");
            const nearEnd = (ddVal >= 14 && ddVal <= 16) || (ddVal >= 26 && ddVal <= 31);
            const ddBad = !ddF || ddF.value === null || ddF.confidence === "low" || nearEnd;
            const mmBad = !mmF || mmF.value === null || mmF.confidence === "low";
            // ── Combined DD+MM retry (one call if both are bad and not near-end) ─
            if (ddBad && !nearEnd && mmBad) {
                console.log(`[Anthropic] DD+MM both bad for ${label} — combined retry`);
                try {
                    const combined = await callAnthropic(base64Image, buildDDMMRetryPrompt(label), apiKey);
                    if (combined.dd) {
                        const padded = String(combined.dd).padStart(2, "0");
                        rawResult.fields[ddKey] = { value: padded, confidence: combined.dd_confidence || "medium" };
                        console.log(`[Anthropic] DD+MM combined → DD=${padded} MM=${combined.mm ?? "null"}`);
                    }
                    const mmVal = combined.mm && combined.mm !== "null" ? combined.mm : null;
                    if (mmVal)
                        rawResult.fields[mmKey] = { value: mmVal, confidence: combined.mm_confidence || "medium" };
                    else
                        warnings.push(`MM for ${label} could not be read — manual verification required`);
                }
                catch (err) {
                    console.log(`[Anthropic] DD+MM combined retry failed: ${err.message}`);
                }
                continue; // don't do individual retries after combined
            }
            // ── Individual DD retry ───────────────────────────────────────────
            if (ddBad) {
                const ddPlus1 = Math.min(ddVal + 1, ddVal <= 16 ? 16 : 31);
                const ddPlus1Str = nearEnd && ddPlus1 > ddVal ? String(ddPlus1).padStart(2, "0") : null;
                console.log(`[Anthropic] DD=${ddF?.value ?? "null"} (conf:${ddF?.confidence ?? "none"}) for ${label}${nearEnd ? " [near-end]" : ""} — retrying`);
                try {
                    const ddResult = await callAnthropic(base64Image, buildDDRetryPrompt(label, ddF?.value ?? null, ddPlus1Str), apiKey);
                    if (ddResult.dd) {
                        const padded = String(ddResult.dd).padStart(2, "0");
                        if (nearEnd && padded === ddF?.value && ddPlus1Str && ddPlus1 > ddVal) {
                            // Near-end bias: if retry didn't change, apply +1 correction
                            const corrected = ddPlus1Str;
                            console.log(`[Anthropic] DD near-end retry unchanged (${padded}) — applying +1 correction → ${corrected}`);
                            warnings.push(`DD=${padded} auto-corrected to ${corrected} (near-end bias) — verify manually`);
                            rawResult.fields[ddKey] = { value: corrected, confidence: "low" };
                        }
                        else {
                            console.log(`[Anthropic] DD retry → ${padded}`);
                            rawResult.fields[ddKey] = { value: padded, confidence: ddResult.confidence || "medium" };
                        }
                        if (nearEnd)
                            nearEndRetryApplied.add(ddKey);
                    }
                }
                catch (err) {
                    console.log(`[Anthropic] DD retry failed: ${err.message}`);
                }
            }
            // ── Individual MM retry ───────────────────────────────────────────
            if (mmBad) {
                const hasOtherData = rawResult.fields[ddKey]?.value != null;
                console.log(`[Anthropic] MM=${mmF?.value ?? "null"} for ${label} — retrying`);
                try {
                    const mmResult = await callAnthropic(base64Image, buildMMRetryPrompt(label, hasOtherData), apiKey);
                    const mmVal = mmResult?.mm && mmResult.mm !== "null" ? mmResult.mm : null;
                    if (mmVal) {
                        rawResult.fields[mmKey] = { value: mmVal, confidence: mmResult.confidence || "medium" };
                        console.log(`[Anthropic] MM retry → ${mmVal}`);
                    }
                    else
                        warnings.push(`MM for ${label} could not be read — manual verification required`);
                }
                catch (err) {
                    console.log(`[Anthropic] MM retry failed: ${err.message}`);
                }
            }
        }
        // ── YY retry (medium also triggered — wrong year is a critical error) ─
        const hasSecondData = rawResult.fields["second_attempt_dd"]?.value != null ||
            rawResult.fields["second_attempt_mm"]?.value != null ||
            rawResult.fields["second_attempt_status"]?.value != null;
        const firstYYF = rawResult.fields["first_appointment_yy"];
        const secondYYF = rawResult.fields["second_attempt_yy"];
        const firstYYBad = !firstYYF || firstYYF.value === null || firstYYF.confidence !== "high";
        const secondYYBad = hasSecondData && (!secondYYF || secondYYF.value === null || secondYYF.confidence !== "high");
        if (firstYYBad && secondYYBad) {
            console.log("[Anthropic] YY bad for both sections — combined retry");
            try {
                const combined = await callAnthropic(base64Image, buildYYBothRetryPrompt(), apiKey);
                if (combined.first_yy && VALID_YEARS.includes(String(combined.first_yy)))
                    rawResult.fields["first_appointment_yy"] = { value: String(combined.first_yy), confidence: combined.first_yy_confidence || "medium" };
                if (combined.second_yy && VALID_YEARS.includes(String(combined.second_yy)))
                    rawResult.fields["second_attempt_yy"] = { value: String(combined.second_yy), confidence: combined.second_yy_confidence || "medium" };
            }
            catch (err) {
                console.log(`[Anthropic] YY combined retry failed: ${err.message}`);
            }
        }
        else {
            const yyRetries = [
                firstYYBad ? { key: "first_appointment_yy", label: "First Appointment", field: firstYYF } : null,
                secondYYBad ? { key: "second_attempt_yy", label: "Second Attempt", field: secondYYF } : null,
            ].filter(Boolean);
            for (const { key, label, field } of yyRetries) {
                console.log(`[Anthropic] YY=${field?.value ?? "null"} (conf:${field?.confidence ?? "none"}) for ${label} — retrying`);
                try {
                    const result = await callAnthropic(base64Image, buildYYSingleRetryPrompt(label), apiKey);
                    if (result.yy && VALID_YEARS.includes(String(result.yy))) {
                        rawResult.fields[key] = { value: String(result.yy), confidence: result.confidence || "medium" };
                        console.log(`[Anthropic] YY retry → ${result.yy} for ${label}`);
                    }
                }
                catch (err) {
                    console.log(`[Anthropic] YY retry failed: ${err.message}`);
                }
            }
        }
        // ── Second attempt section retry (year gap / terminal status) ────────
        const fComp = parseDateComponents(rawResult.fields, "first_appointment");
        const sComp = parseDateComponents(rawResult.fields, "second_attempt");
        const yearGap = fComp.yy && sComp.yy && Math.abs(parseInt(sComp.yy) - parseInt(fComp.yy)) > 1;
        const secondHasData = sComp.dd != null || sComp.mm != null;
        const terminalFirst = ["Completed", "Missed", "Cancelled"].includes(fComp.status ?? "");
        if (yearGap || (terminalFirst && secondHasData)) {
            const reason = yearGap ? `Year gap (${fComp.yy} vs ${sComp.yy})` : `First status='${fComp.status}'`;
            console.log(`[Anthropic] ${reason} — retrying second attempt section`);
            try {
                const retried = await callAnthropic(base64Image, buildSecondSectionRetryPrompt(fComp.dd || "", fComp.mm || "", fComp.yy || ""), apiKey);
                const origYY = parseInt(sComp.yy || "0");
                const retryYY = parseInt(retried["second_attempt_yy"]?.value || "0");
                const anchorYY = parseInt(fComp.yy || "0");
                const retryGap = anchorYY ? Math.abs(retryYY - anchorYY) : 0;
                const currentYear = new Date().getFullYear();
                if (yearGap && retryGap > Math.abs(origYY - anchorYY) && retryGap > 1) {
                    warnings.push("Second attempt retry rejected — year gap worse than original");
                }
                else if (retryYY > currentYear + 1) {
                    warnings.push("Second attempt retry rejected — year implausibly far in future");
                }
                else {
                    for (const key of ["second_attempt_dd", "second_attempt_mm", "second_attempt_yy", "second_attempt_status"]) {
                        if (key === "second_attempt_dd" && nearEndRetryApplied.has(key))
                            continue;
                        if (retried[key]?.value !== null && retried[key]?.value !== undefined) {
                            if (retried[key].value !== rawResult.fields[key]?.value)
                                secondRetryChanged = true;
                            rawResult.fields[key] = retried[key];
                        }
                    }
                    console.log(`[Anthropic] Second attempt retry applied: DD=${retried["second_attempt_dd"]?.value} MM=${retried["second_attempt_mm"]?.value} YY=${retried["second_attempt_yy"]?.value}`);
                }
            }
            catch (err) {
                console.log(`[Anthropic] Second attempt retry failed: ${err.message}`);
            }
        }
        // ── Cross-validation ───────────────────────────────────────────────
        crossValidationFired = await crossValidateSchedule(base64Image, rawResult.fields, apiKey, warnings);
    }
    // ── Image quality (Haiku, non-blocking) ──────────────────────────────
    assessImageQuality(lowResBase64, apiKey, warnings).catch(() => { });
    if (crossValidationFired)
        warnings.push("Logical inconsistencies detected in date fields — values may still be inaccurate despite auto-correction");
    if (secondRetryChanged)
        warnings.push("Second attempt section required re-extraction — initial read was incorrect, verify values");
    // ── Map fields → AIExtractionResult (DiaryPage question IDs) ─────────
    //
    // For schedule pages the extraction uses cantrac-omr field names
    // (first_appointment_dd / _mm / _yy / _status, second_attempt_*, etc.)
    // and we need to map them back to the DiaryPage question IDs (q1, q2, …).
    // Strategy:
    //   date-type questions (by position): 1st → first_appointment, 2nd → second_attempt
    //   select-type questions (by position): 1st → first_appointment_status, 2nd → second_attempt_status
    //   yes_no questions (non-schedule): mapped directly by question.id
    // ──────────────────────────────────────────────────────────────────────
    const extraction = {};
    if (isSchedule) {
        const dateQs = questions.filter(q => q.type === "date");
        const statusQs = questions.filter(q => q.type === "select");
        const yesNoQs = questions.filter(q => q.type === "yes_no");
        const datePrefixes = ["first_appointment", "second_attempt"];
        const statusPrefixes = ["first_appointment_status", "second_attempt_status"];
        for (let i = 0; i < dateQs.length; i++) {
            const q = dateQs[i];
            const pfx = datePrefixes[i];
            if (!pfx) {
                extraction[q.id] = { value: null, confidence: 0 };
                continue;
            }
            const dd = rawResult.fields[`${pfx}_dd`]?.value ?? null;
            const mm = rawResult.fields[`${pfx}_mm`]?.value ?? null;
            const yy = rawResult.fields[`${pfx}_yy`]?.value ?? null;
            const ddC = rawResult.fields[`${pfx}_dd`]?.confidence;
            const mmC = rawResult.fields[`${pfx}_mm`]?.confidence;
            const yyC = rawResult.fields[`${pfx}_yy`]?.confidence;
            const minConf = Math.min(CONFIDENCE_MAP[ddC ?? ""] ?? 0, CONFIDENCE_MAP[mmC ?? ""] ?? 0, CONFIDENCE_MAP[yyC ?? ""] ?? 0);
            extraction[q.id] = { value: assembleDateString(dd, mm, yy), confidence: minConf || 0 };
        }
        for (let i = 0; i < statusQs.length; i++) {
            const q = statusQs[i];
            const fKey = statusPrefixes[i];
            if (!fKey) {
                extraction[q.id] = { value: null, confidence: 0 };
                continue;
            }
            const raw = rawResult.fields[fKey];
            extraction[q.id] = { value: raw?.value ?? null, confidence: CONFIDENCE_MAP[raw?.confidence ?? ""] ?? 0 };
        }
        // next_appointment_required → first yes_no question
        const nextApptRaw = rawResult.fields["next_appointment_required"];
        if (yesNoQs[0] && nextApptRaw) {
            let val = nextApptRaw.value;
            if (val)
                val = val.toLowerCase().includes("y") ? "yes" : val.toLowerCase().includes("n") ? "no" : val;
            extraction[yesNoQs[0].id] = { value: val, confidence: CONFIDENCE_MAP[nextApptRaw.confidence ?? ""] ?? 0 };
        }
    }
    else {
        // Yes/no and other pages — fields keyed by question.id in the prompt
        for (const question of questions) {
            if (question.type === "info")
                continue;
            const raw = rawResult.fields?.[question.id];
            if (raw) {
                let value = raw.value ?? null;
                if (question.type === "yes_no" && value) {
                    const lower = value.toLowerCase().trim();
                    if (["yes", "हाँ", "y", "true"].includes(lower))
                        value = "yes";
                    else if (["no", "नहीं", "n", "false"].includes(lower))
                        value = "no";
                }
                const conf = CONFIDENCE_MAP[raw.confidence ?? "medium"] ?? 0.75;
                extraction[question.id] = { value, confidence: conf };
                if (raw.confidence === "low")
                    warnings.push(`Low confidence on "${question.id}": ${question.text}`);
            }
            else {
                warnings.push(`Field "${question.id}" not returned by Anthropic`);
                extraction[question.id] = { value: null, confidence: 0 };
            }
        }
    }
    const processingTimeMs = Date.now() - startTime;
    const scores = Object.values(extraction).map(f => f.confidence).filter(c => c > 0);
    const overallConfidence = scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : 0;
    console.log(`[Anthropic] Page ${pageNumber} done — ${Object.keys(extraction).length} fields, conf=${overallConfidence}, ${processingTimeMs}ms`);
    return { extraction, processingTimeMs, overallConfidence, warnings };
}
exports.extractWithAnthropic = extractWithAnthropic;
function isAnthropicConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
}
exports.isAnthropicConfigured = isAnthropicConfigured;
