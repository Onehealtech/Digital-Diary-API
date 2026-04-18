"use strict";
/**
 * Anthropic Claude Vision Extraction Service
 *
 * Ported from cantrac-omr into the Digital Diary API pipeline.
 *   - Sharp preprocessing: EXIF rotation + pink-header orientation + form crop + normalize + sharpen
 *   - Anthropic claude-sonnet-4-6 via direct HTTP
 *   - Schedule pages: chain-of-thought reasoning + 3000px high-res + DD/MM/YY retries
 *   - Returns AIExtractionResult — identical format to the existing pipeline
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
const MAX_TOKENS = 4096;
const ANTHROPIC_TIMEOUT_MS = 60000; // 60 s — handles slow large-image uploads
// Standard pages: 1600px / q=85  |  Schedule pages (tiny date bubbles): 3000px / q=95
const STD_MAX_DIM = 1600;
const STD_QUALITY = 85;
const SCHED_MAX_DIM = 3000;
const SCHED_QUALITY = 95;
const CONFIDENCE_MAP = {
    high: 0.95,
    medium: 0.75,
    low: 0.45,
};
// ─── Image Preprocessing ──────────────────────────────────────────────────
/**
 * Measure fraction of pink pixels in the top 12% of an image.
 * Used to detect which rotation puts the pink CANTrac header banner at the top.
 */
async function pinkAtTop(buf) {
    const m = await (0, sharp_1.default)(buf).metadata();
    if (!m.width || !m.height)
        return 0;
    const h = Math.floor(m.height * 0.12);
    const { data, info } = await (0, sharp_1.default)(buf)
        .extract({ left: 0, top: 0, width: m.width, height: h })
        .resize(80, undefined)
        .raw()
        .toBuffer({ resolveWithObject: true });
    let n = 0;
    for (let i = 0; i < data.length; i += info.channels) {
        if (data[i] > 160 && data[i + 1] < 140 && data[i + 2] < 160)
            n++;
    }
    return n / (data.length / info.channels);
}
/**
 * Crop the image to the white paper form, removing background (bedsheet, table, etc.).
 * A strip counts as "form" only when >30% of its pixels are clearly white.
 * Ported from cantrac-omr/src/utils/image-preprocessor.js
 */
async function cropToForm(buffer, meta, skipAspectGuard = false) {
    const ANALYSIS_SIZE = 300;
    const DENSITY = 0.30; // >30% white = clearly form paper
    const EDGE_DENSITY = 0.05; // >5%  white = any form content (outer boundary)
    const PADDING = 20;
    const { data, info } = await (0, sharp_1.default)(buffer)
        .grayscale()
        .normalize()
        .resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: "inside" })
        .raw()
        .toBuffer({ resolveWithObject: true });
    const mWidth = meta.width || info.width;
    const mHeight = meta.height || info.height;
    const scaleX = mWidth / info.width;
    const scaleY = mHeight / info.height;
    // Adaptive threshold: 20 below the 80th-percentile brightness
    const sorted = Buffer.from(data).sort();
    const threshold = Math.max(180, sorted[Math.floor(sorted.length * 0.80)] - 20);
    const colWhite = new Float32Array(info.width);
    const rowWhite = new Float32Array(info.height);
    for (let r = 0; r < info.height; r++) {
        for (let c = 0; c < info.width; c++) {
            if (data[r * info.width + c] >= threshold) {
                colWhite[c] += 1 / info.height;
                rowWhite[r] += 1 / info.width;
            }
        }
    }
    let minCol = 0, maxCol = info.width - 1;
    let minRow = 0, maxRow = info.height - 1;
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
    // Only crop when background is substantial (>30%); smaller crops risk cutting the form.
    const cropFrac = 1 - ((maxRow - minRow) * (maxCol - minCol)) / (info.height * info.width);
    if (cropFrac < 0.30) {
        console.log("[Preprocessor] Background too small to crop safely — skipping");
        return buffer;
    }
    const left = Math.max(0, Math.floor(minCol * scaleX));
    const top = Math.max(0, Math.floor(minRow * scaleY));
    const right = Math.min(mWidth, Math.ceil(maxCol * scaleX));
    const bottom = Math.min(mHeight, Math.ceil(maxRow * scaleY));
    const width = right - left;
    const height = bottom - top;
    // Skip if crop would drastically change landscape aspect ratio (>1.5× change).
    if (!skipAspectGuard) {
        const originalAspect = mWidth / mHeight;
        const cropAspect = width / height;
        const aspectRatio = Math.max(originalAspect, cropAspect) / Math.min(originalAspect, cropAspect);
        if (originalAspect > 1 && aspectRatio > 1.5) {
            console.log("[Preprocessor] Crop would distort landscape aspect — skipping");
            return buffer;
        }
    }
    console.log(`[Preprocessor] Cropping to form: ${left},${top} → ${width}×${height} (was ${mWidth}×${mHeight})`);
    return (0, sharp_1.default)(buffer).extract({ left, top, width, height }).toBuffer();
}
/**
 * Preprocess a phone photo for optimal vision API extraction.
 *
 * Steps:
 *   1. Auto-rotate via EXIF
 *   2. Portrait image: pick rotation direction that puts pink header at top
 *   3. Verify form itself is landscape (form might be portrait-oriented within a landscape frame)
 *   4. Crop to white paper area, removing background
 *   5. Resize, normalize contrast, sharpen, compress
 */
async function preprocessForVision(imageBuffer, maxDimension = STD_MAX_DIM, quality = STD_QUALITY) {
    // Step 1: Auto-rotate via EXIF
    let rotatedBuffer = await (0, sharp_1.default)(imageBuffer).rotate().toBuffer();
    let rotatedMeta = await (0, sharp_1.default)(rotatedBuffer).metadata();
    // Step 2: Portrait → pick the rotation direction that puts the pink header at the top
    let wasPortrait = false;
    if (rotatedMeta.height && rotatedMeta.width && rotatedMeta.height > rotatedMeta.width) {
        wasPortrait = true;
        console.log("[Preprocessor] Portrait image detected — detecting correct rotation direction");
        const cw90 = await (0, sharp_1.default)(rotatedBuffer).rotate(90).toBuffer();
        const cw270 = await (0, sharp_1.default)(rotatedBuffer).rotate(270).toBuffer();
        const [pink90, pink270] = await Promise.all([pinkAtTop(cw90), pinkAtTop(cw270)]);
        rotatedBuffer = pink270 > pink90 ? cw270 : cw90;
        console.log(`[Preprocessor] Chose ${pink270 > pink90 ? "270°" : "90°"} CW (pink90=${pink90.toFixed(3)} pink270=${pink270.toFixed(3)})`);
        rotatedMeta = await (0, sharp_1.default)(rotatedBuffer).metadata();
    }
    // Step 3: Verify the form itself is landscape (aspect ratio of the cropped form should be >1.15)
    if (wasPortrait && rotatedMeta.width && rotatedMeta.height && rotatedMeta.width > rotatedMeta.height) {
        const prelim = await cropToForm(rotatedBuffer, rotatedMeta, true);
        const prelimMeta = await (0, sharp_1.default)(prelim).metadata();
        if (prelimMeta.width && prelimMeta.height && (prelimMeta.width / prelimMeta.height) < 1.15) {
            rotatedBuffer = await (0, sharp_1.default)(rotatedBuffer).rotate(90).toBuffer();
            rotatedMeta = await (0, sharp_1.default)(rotatedBuffer).metadata();
            console.log("[Preprocessor] Form appears portrait-shaped in landscape frame — rotating +90° CW");
        }
    }
    // Step 4: Crop to the white paper form area
    rotatedBuffer = await cropToForm(rotatedBuffer, rotatedMeta);
    rotatedMeta = await (0, sharp_1.default)(rotatedBuffer).metadata();
    // Step 5: Resize, enhance, compress
    return (0, sharp_1.default)(rotatedBuffer)
        .resize(maxDimension, maxDimension, { fit: "inside", withoutEnlargement: true })
        .normalize()
        .sharpen({ sigma: 1.0 })
        .jpeg({ quality })
        .toBuffer();
}
// ─── Prompt Building ──────────────────────────────────────────────────────
function buildSystemPrompt() {
    return `You are a medical form OCR specialist for the CANTrac breast cancer surgery tracker.
Your job is to examine photos of paper diary pages and extract which bubbles are filled.

CRITICAL RULES:
1. A FILLED bubble is dark (blue/purple ink, fully colored in). An EMPTY bubble is light gray or has just an outline. The contrast between filled and empty is VERY clear — filled bubbles are noticeably darker.
2. Return ONLY valid JSON — no markdown, no backticks, no explanation.
3. If a bubble appears partially filled or ambiguous, mark it as filled and set confidence to "low".
4. If you cannot determine a field at all (image too blurry, cut off), set value to null.
5. For Yes/No fields: return "Yes" or "No" (or null if unreadable).
6. For status fields: return one of the exact option strings.
7. The page number is printed at the top center of every page.
8. Photos may be taken at an angle, rotated sideways, or on a textured background — mentally rotate the image if needed to read the form correctly. Focus on the white paper area.
9. For DATE ROWS (DD/MM/YY): these have rows of small bubbles numbered 01-31, or labeled Jan-Dec, or 2026/2027/2028. You MUST scan each bubble carefully. Exactly ONE bubble per row will be filled dark. The rest will be empty (light outline). Report the value next to the filled bubble. DD values must be zero-padded: "01", "05", "14", "31".`;
}
function buildExtractionPrompt(pageNumber, pageTitle, questions) {
    const isSchedule = questions.some(q => q.type === "date" || q.type === "select");
    if (isSchedule)
        return buildSchedulePrompt(pageNumber, pageTitle);
    const fieldLines = questions
        .filter(q => q.type !== "info")
        .map((q, i) => {
        if (q.type === "yes_no")
            return `  ${i + 1}. "${q.id}" (yes_no): "${q.text}" → options: [Yes | No]`;
        if (q.type === "text")
            return `  ${i + 1}. "${q.id}" (text): "${q.text}" → read handwritten text or ""`;
        const opts = q.options?.join(" | ") || "Yes | No";
        return `  ${i + 1}. "${q.id}" (${q.type}): "${q.text}" → options: [${opts}]`;
    })
        .join("\n");
    const exampleFields = questions
        .filter(q => q.type !== "info")
        .map(q => `    "${q.id}": { "value": <extracted_value_or_null>, "confidence": "high"|"medium"|"low" }`)
        .join(",\n");
    return `This is CANTrac page ${pageNumber}: "${pageTitle}"

Extract the value of each field by examining which bubble is filled (dark/colored) next to each question.

Fields to extract:
${fieldLines}

Respond with ONLY this JSON (no markdown, no backticks):
{
  "pageNumber": ${pageNumber},
  "title": "${pageTitle}",
  "fields": {
${exampleFields}
  }
}`;
}
function buildSchedulePrompt(pageNumber, pageTitle) {
    return `This is CANTrac page ${pageNumber}: "${pageTitle}"

This is a SCHEDULE PAGE with appointment dates filled by a patient using dark blue/purple ink.

STEP-BY-STEP ANALYSIS REQUIRED:
For each section, carefully analyze each row of bubbles and describe what you see before giving the answer.

SECTION 1: "First Appointment" (first/top section on the page)
1. DD row: There are TWO separate lines of bubbles.
   - Line 1 has EXACTLY 16 bubbles for days 01 through 16. No more, no fewer.
   - Line 2 has EXACTLY 15 bubbles for days 17 through 31.
   Find the ONE dark filled bubble. Count empty bubbles to its LEFT (N) and RIGHT (R) on the same line.
   - Filled on Line 1: day = N + 1. Sanity check: N+R+1 should equal 16.
   - Filled on Line 2: day = N + 17. Sanity check: N+R+1 should equal 15.
   EDGE-POSITION WARNING: If N ≥ 13 (bubble is in positions 14-16), ALSO count from the right (R). Verify: day = N+1 from left AND day = 16-R or 31-R from right — both must agree.
   Report as zero-padded two digits: "01", "05", "15", "29".
2. MM row: 12 bubbles in order Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec.
   Count N empty bubbles to the LEFT of the filled bubble → month = (N+1)th in sequence:
   N=0→Jan, N=1→Feb, N=2→Mar, N=3→Apr, N=4→May, N=5→Jun,
   N=6→Jul, N=7→Aug, N=8→Sep, N=9→Oct, N=10→Nov, N=11→Dec.
   NOTE: December is the RIGHTMOST bubble — easy to miss, check it carefully.
3. YY row: Three bubbles — LEFTMOST is 2026, MIDDLE is 2027, RIGHTMOST is 2028. Which is SOLID dark?
4. Status row: Scheduled, Completed, Missed, Cancelled. Which is filled?

SECTION 2: "Second Attempt (If First Missed/Cancelled)" (second/bottom section)
Same structure as Section 1. May be completely empty if no second attempt was needed.

FINAL QUESTION: "Next Appointment Required" at the very bottom — Yes or No.

HOW TO TELL FILLED vs EMPTY:
- FILLED: Circle interior is COMPLETELY SOLID — dark blue or dark purple. No light center. Stands out from all neighbors.
- EMPTY: Circle has only a thin ring outline (light pink or gray). Center is white/light — you can see through it.
- Exactly ONE filled bubble per row (or zero). If two look similar, pick the darker one, confidence "medium".

Respond with this JSON. The "reasoning" field is REQUIRED — describe what you see before committing:
{
  "pageNumber": ${pageNumber},
  "pageType": "schedule",
  "title": "${pageTitle}",
  "reasoning": {
    "first_dd": "Line 1 (16 bubbles): N=[?] empty left, R=[?] empty right, N+R+1=[?]. Day=N+1=[?]. OR Line 2: same. Final: day=[?].",
    "first_mm": "N=[?] empty to left of filled bubble → month=[?]. Label to right: [label]. Confirmed: [yes/no].",
    "first_yy": "2026 bubble: [filled|empty]. 2027: [filled|empty]. 2028: [filled|empty]. Chose: [year].",
    "first_status": "Scheduled: [filled|empty]. Completed: [filled|empty]. Missed: [filled|empty]. Cancelled: [filled|empty].",
    "second_dd": "Second attempt DD: [describe or 'section blank'].",
    "second_mm": "Second attempt MM: [describe or 'section blank'].",
    "second_yy": "Second attempt YY: [describe or 'section blank'].",
    "second_status": "Second attempt status: [describe or 'section blank']."
  },
  "fields": {
    "q1_date": { "value": "<DD/Mon/YYYY or null>", "confidence": "high|medium|low" },
    "q1_status": { "value": "<Scheduled|Completed|Missed|Cancelled or null>", "confidence": "high|medium|low" },
    "q2_date": { "value": "<DD/Mon/YYYY or null>", "confidence": "high|medium|low" },
    "q2_status": { "value": "<Scheduled|Completed|Missed|Cancelled or null>", "confidence": "high|medium|low" },
    "q3": { "value": "<Yes|No or null>", "confidence": "high|medium|low" }
  }
}`;
}
function buildDateRetryPrompt(section, pageTitle) {
    const label = section === "first" ? "First Appointment" : "Second Attempt (If First Missed/Cancelled)";
    const fieldId = section === "first" ? "q1_date" : "q2_date";
    return `Look at this CANTrac schedule page: "${pageTitle}".
Focus ONLY on the "${label}" section.

Read the DATE by analyzing THREE bubble rows:

DD row (two lines):
- Line 1: EXACTLY 16 bubbles, days 01-16
- Line 2: EXACTLY 15 bubbles, days 17-31
Count empty bubbles to the LEFT of the dark filled bubble (N).
Line 1: day = N+1. Line 2: day = N+17.
If the bubble is near position 14-16 or 26-31, also count from the right to confirm.

MM row: 12 bubbles — Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec
N empty to the left → month = (N+1)th name.
NOTE: December is the RIGHTMOST bubble — check it carefully.

YY row: LEFTMOST=2026, MIDDLE=2027, RIGHTMOST=2028. Which is solid dark?

If this section is completely blank (no bubbles filled at all), return null.

Respond with ONLY this JSON (no markdown, no backticks):
{ "${fieldId}": { "value": "<DD/Mon/YYYY or null>", "confidence": "high|medium|low" } }`;
}
function buildStatusRetryPrompt(section, pageTitle) {
    const label = section === "first" ? "First Appointment" : "Second Attempt";
    const fieldId = section === "first" ? "q1_status" : "q2_status";
    return `Look at this CANTrac schedule page: "${pageTitle}".
Focus ONLY on the STATUS row of the "${label}" section.

Four bubbles: Scheduled | Completed | Missed | Cancelled
Which ONE bubble is SOLID dark (filled with dark blue/purple ink)?
If none are filled, return null.

Respond with ONLY this JSON (no markdown, no backticks):
{ "${fieldId}": { "value": "<Scheduled|Completed|Missed|Cancelled|null>", "confidence": "high|medium|low" } }`;
}
// ─── Anthropic API Calls ──────────────────────────────────────────────────
async function callAnthropicAPI(base64Image, systemPrompt, userPrompt, apiKey) {
    const body = {
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{
                role: "user",
                content: [
                    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Image } },
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
            },
            body: JSON.stringify(body),
            signal: abort.signal,
        });
    }
    catch (err) {
        clearTimeout(timer);
        if (err.name === "AbortError")
            throw new Error("Anthropic API request timed out after 60 s");
        // "terminated" / UND_ERR_SOCKET — server closed the connection mid-upload
        // (usually an invalid API key that caused an early 4xx + connection close)
        throw new Error(`Anthropic API network error: ${err.message}. Check ANTHROPIC_API_KEY in .env`);
    }
    clearTimeout(timer);
    if (!response.ok) {
        const errText = await response.text();
        if (response.status === 401)
            throw new Error("Anthropic API: invalid API key — set ANTHROPIC_API_KEY correctly in .env");
        if (response.status === 429)
            throw new Error("Anthropic API: rate limit exceeded — retry later");
        throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }
    const data = await response.json();
    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("").trim();
    if (!text)
        throw new Error("Anthropic API returned empty response");
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    // Fix bare leading zeros in JSON number literals (e.g. 012 → 12)
    const fixed = cleaned.replace(/:\s*0+(\d+)/g, ": $1");
    try {
        return JSON.parse(fixed);
    }
    catch {
        throw new Error(`Failed to parse Anthropic response as JSON: ${cleaned.substring(0, 500)}`);
    }
}
/**
 * Lightweight focused call for single-field retries.
 * Uses a lower max_tokens budget since the response is a tiny JSON object.
 */
async function callAnthropicFocused(base64Image, userPrompt, apiKey) {
    const body = {
        model: ANTHROPIC_MODEL,
        max_tokens: 256,
        system: buildSystemPrompt(),
        messages: [{
                role: "user",
                content: [
                    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Image } },
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
            headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
            body: JSON.stringify(body),
            signal: abort.signal,
        });
    }
    catch (err) {
        clearTimeout(timer);
        if (err.name === "AbortError")
            throw new Error("Anthropic API retry timed out after 60 s");
        throw new Error(`Anthropic API network error: ${err.message}`);
    }
    clearTimeout(timer);
    if (!response.ok)
        throw new Error(`Focused retry API error (${response.status})`);
    const data = await response.json();
    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("").trim();
    if (!text)
        throw new Error("Empty response from focused retry");
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    return JSON.parse(cleaned);
}
// ─── Main Export ──────────────────────────────────────────────────────────
async function extractWithAnthropic(imageBuffer, pageNumber, pageTitle, questions) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
        throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
    const startTime = Date.now();
    const warnings = [];
    const isSchedule = questions.some(q => q.type === "date" || q.type === "select");
    // Preprocess image — higher resolution for schedule pages (tiny date bubbles)
    const processedBuffer = await preprocessForVision(imageBuffer, isSchedule ? SCHED_MAX_DIM : STD_MAX_DIM, isSchedule ? SCHED_QUALITY : STD_QUALITY);
    const base64Image = processedBuffer.toString("base64");
    const rawResult = await callAnthropicAPI(base64Image, buildSystemPrompt(), buildExtractionPrompt(pageNumber, pageTitle, questions), apiKey);
    if (rawResult.reasoning) {
        console.log("[Anthropic] Model reasoning:", JSON.stringify(rawResult.reasoning, null, 2));
        delete rawResult.reasoning;
    }
    // ── Schedule page retries ─────────────────────────────────────────────
    // For each date/status field that came back null or low-confidence, fire
    // a focused single-field prompt to get a better answer.
    if (isSchedule && rawResult.fields) {
        const sections = [
            { dateId: "q1_date", statusId: "q1_status", section: "first" },
            { dateId: "q2_date", statusId: "q2_status", section: "second" },
        ];
        for (const { dateId, statusId, section } of sections) {
            // Date retry
            const dateField = rawResult.fields[dateId];
            if (!dateField || dateField.value === null || dateField.confidence === "low") {
                console.log(`[Anthropic] ${dateId}=${dateField?.value ?? "null"} (${dateField?.confidence ?? "none"}) — retrying with focused prompt`);
                try {
                    const retryFields = await callAnthropicFocused(base64Image, buildDateRetryPrompt(section, pageTitle), apiKey);
                    if (retryFields[dateId]?.value) {
                        console.log(`[Anthropic] ${dateId} retry result: ${retryFields[dateId].value}`);
                        rawResult.fields[dateId] = retryFields[dateId];
                    }
                }
                catch (err) {
                    console.log(`[Anthropic] ${dateId} retry failed: ${err.message}`);
                }
            }
            // Status retry
            const statusField = rawResult.fields[statusId];
            if (!statusField || statusField.value === null || statusField.confidence === "low") {
                console.log(`[Anthropic] ${statusId}=${statusField?.value ?? "null"} — retrying with focused prompt`);
                try {
                    const retryFields = await callAnthropicFocused(base64Image, buildStatusRetryPrompt(section, pageTitle), apiKey);
                    if (retryFields[statusId]?.value) {
                        console.log(`[Anthropic] ${statusId} retry result: ${retryFields[statusId].value}`);
                        rawResult.fields[statusId] = retryFields[statusId];
                    }
                }
                catch (err) {
                    console.log(`[Anthropic] ${statusId} retry failed: ${err.message}`);
                }
            }
        }
    }
    // ── Map fields → AIExtractionResult ──────────────────────────────────
    const extraction = {};
    for (const question of questions) {
        if (question.type === "info")
            continue;
        const raw = rawResult.fields?.[question.id];
        if (raw) {
            const confidenceStr = raw.confidence || "medium";
            const confidence = CONFIDENCE_MAP[confidenceStr] ?? 0.75;
            let value = raw.value ?? null;
            if (question.type === "yes_no" && value) {
                const lower = value.toLowerCase().trim();
                if (["yes", "हाँ", "y", "true"].includes(lower))
                    value = "yes";
                else if (["no", "नहीं", "n", "false"].includes(lower))
                    value = "no";
            }
            extraction[question.id] = { value, confidence };
            if (confidenceStr === "low")
                warnings.push(`Low confidence on "${question.id}": ${question.text}`);
        }
        else {
            warnings.push(`Field "${question.id}" not returned by Anthropic`);
            extraction[question.id] = { value: null, confidence: 0 };
        }
    }
    const processingTimeMs = Date.now() - startTime;
    const scores = Object.values(extraction).map(f => f.confidence);
    const overallConfidence = scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : 0;
    console.log(`[Anthropic] Page ${pageNumber} extracted — ${Object.keys(extraction).length} fields, ` +
        `confidence=${overallConfidence}, ${processingTimeMs}ms`);
    return { extraction, processingTimeMs, overallConfidence, warnings };
}
exports.extractWithAnthropic = extractWithAnthropic;
function isAnthropicConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
}
exports.isAnthropicConfigured = isAnthropicConfigured;
