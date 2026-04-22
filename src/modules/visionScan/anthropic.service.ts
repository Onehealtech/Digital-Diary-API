/**
 * Anthropic Claude Vision Extraction Service
 * Ported from cantrac-omr/src/services/vision-extraction.js
 *
 * Improvements over the base pipeline:
 *   - Prompt caching (cache_control: ephemeral) — retries cost ~10% of normal price
 *   - Claude Haiku for cheap form-validity + image-quality checks
 *   - Granular DD / MM / YY component retries (separate focused prompts)
 *   - Near-end DD bias correction (positions 14-16, 26-31)
 *   - Combined DD+MM / YY retries in one API call
 *   - Cross-validation: same-month misread, future-year for terminal status
 *   - Token usage tracking (Sonnet vs Haiku, cache reads/writes, estimated cost)
 *   - Image metadata (dimensions, compression ratio, portrait detection)
 *   - Bilingual rescan tips (English + Hindi)
 */

import sharp from "sharp";
import { AIExtractionResult, DiaryQuestion } from "./visionScan.types";

// ─── Config ────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL    = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL      = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const HAIKU_MODEL          = "claude-haiku-4-5-20251001";
const MAX_TOKENS           = 4096;
const ANTHROPIC_TIMEOUT_MS = 60_000;

const STD_MAX_DIM   = 1600;
const STD_QUALITY   = 85;
const SCHED_MAX_DIM = 2400;
const SCHED_QUALITY = 90;
const LOWRES_MAX    = 800;
const LOWRES_QUAL   = 70;

const CONFIDENCE_MAP: Record<string, number> = { high: 0.95, medium: 0.75, low: 0.45 };

const VALID_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const VALID_YEARS  = ["2026","2027","2028"];

// ─── Types ─────────────────────────────────────────────────────────────────

interface AnthropicField { value: string | null; confidence: "high" | "medium" | "low"; }

interface AnthropicRawResult {
    pageNumber?: number; pageType?: string; title?: string;
    reasoning?:  Record<string, string>;
    fields:      Record<string, AnthropicField>;
}

/** Token tracking bucket — updated in-place by every callAnthropic / callHaiku call. */
interface TokenTracker {
    calls:             number;
    sonnetInput:       number;
    sonnetOutput:      number;
    haikuInput:        number;
    haikuOutput:       number;
    cacheWriteTokens:  number;
    cacheReadTokens:   number;
}

function makeTracker(): TokenTracker {
    return { calls:0, sonnetInput:0, sonnetOutput:0, haikuInput:0, haikuOutput:0, cacheWriteTokens:0, cacheReadTokens:0 };
}

export interface CantracTokenUsage {
    apiCalls:          number;
    inputTokens:       number;
    outputTokens:      number;
    cacheWriteTokens:  number;
    cacheReadTokens:   number;
    totalTokens:       number;
    estimatedCostUSD:  number;
}

export interface ImageMetadata {
    originalWidth:    number;
    originalHeight:   number;
    originalFormat:   string;
    originalSize:     number;
    processedWidth:   number;
    processedHeight:  number;
    processedSize:    number;
    compressionRatio: string;
    wasPortrait:      boolean;
}

export interface RescanTip { english: string; hindi: string; }

export interface AnthropicExtractionResult {
    extraction:          AIExtractionResult;
    processingTimeMs:    number;
    overallConfidence:   number;
    warnings:            string[];
    /** Raw cantrac-omr style fields (separate DD/MM/YY/status) — stored in processingMetadata */
    cantracFields:       Record<string, AnthropicField>;
    rescanTip:           RescanTip | null;
    isValidCantracForm:  boolean;
    imageMetadata:       ImageMetadata;
    tokenUsage:          CantracTokenUsage;
}

// ─── Image Preprocessing ──────────────────────────────────────────────────

async function pinkAtTop(buf: Buffer): Promise<number> {
    const m = await sharp(buf).metadata();
    if (!m.width || !m.height) return 0;
    const h = Math.floor(m.height * 0.12);
    const { data, info } = await sharp(buf)
        .extract({ left: 0, top: 0, width: m.width, height: h })
        .resize(80, undefined).raw().toBuffer({ resolveWithObject: true });
    let n = 0;
    for (let i = 0; i < data.length; i += info.channels)
        if (data[i] > 160 && data[i + 1] < 140 && data[i + 2] < 160) n++;
    return n / (data.length / info.channels);
}

async function cropToForm(buffer: Buffer, meta: sharp.Metadata, skipAspectGuard = false): Promise<Buffer> {
    const DENSITY = 0.30; const EDGE_DENSITY = 0.05; const PADDING = 20;
    const { data, info } = await sharp(buffer).grayscale().normalize()
        .resize(300, 300, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
    const mW = meta.width || info.width; const mH = meta.height || info.height;
    const sX = mW / info.width; const sY = mH / info.height;
    const sorted = Buffer.from(data).sort();
    const thr = Math.max(180, sorted[Math.floor(sorted.length * 0.80)] - 20);
    const colW = new Float32Array(info.width); const rowW = new Float32Array(info.height);
    for (let r = 0; r < info.height; r++)
        for (let c = 0; c < info.width; c++)
            if (data[r * info.width + c] >= thr) { colW[c] += 1/info.height; rowW[r] += 1/info.width; }
    let minC = 0, maxC = info.width-1, minR = 0, maxR = info.height-1;
    for (let c = 0;           c < info.width;  c++) if (colW[c] >= DENSITY)      { minC = c; break; }
    for (let c = info.width-1; c >= 0;         c--) if (colW[c] >= EDGE_DENSITY) { maxC = c; break; }
    for (let r = 0;           r < info.height; r++) if (rowW[r] >= DENSITY)      { minR = r; break; }
    for (let r = info.height-1; r >= 0;        r--) if (rowW[r] >= EDGE_DENSITY) { maxR = r; break; }
    minC = Math.max(0, minC-PADDING); maxC = Math.min(info.width-1,  maxC+PADDING);
    minR = Math.max(0, minR-PADDING); maxR = Math.min(info.height-1, maxR+PADDING);
    const cropFrac = 1 - ((maxR-minR)*(maxC-minC)) / (info.height*info.width);
    if (cropFrac < 0.30) { console.log("[Preprocessor] Background too small — skipping crop"); return buffer; }
    const left = Math.max(0, Math.floor(minC*sX)); const top = Math.max(0, Math.floor(minR*sY));
    const right = Math.min(mW, Math.ceil(maxC*sX)); const bottom = Math.min(mH, Math.ceil(maxR*sY));
    const width = right-left; const height = bottom-top;
    if (!skipAspectGuard) {
        const oA = mW/mH; const cA = width/height;
        if (oA > 1 && Math.max(oA,cA)/Math.min(oA,cA) > 1.5) {
            console.log("[Preprocessor] Crop would distort landscape — skipping"); return buffer;
        }
    }
    console.log(`[Preprocessor] Cropping: ${left},${top} → ${width}×${height} (was ${mW}×${mH})`);
    return sharp(buffer).extract({ left, top, width, height }).toBuffer();
}

/** Returns processed buffer + image metadata (dimensions, format, size, wasPortrait). */
async function preprocessForVision(
    imageBuffer: Buffer,
    maxDimension = STD_MAX_DIM,
    quality = STD_QUALITY
): Promise<{ buffer: Buffer; metadata: Omit<ImageMetadata, "processedWidth"|"processedHeight"|"processedSize"|"compressionRatio"> & { _raw: Buffer } }> {
    const origMeta = await sharp(imageBuffer).metadata();

    let buf = await sharp(imageBuffer).rotate().toBuffer();
    let meta = await sharp(buf).metadata();
    let wasPortrait = false;

    if (meta.height && meta.width && meta.height > meta.width) {
        wasPortrait = true;
        const cw90  = await sharp(buf).rotate(90).toBuffer();
        const cw270 = await sharp(buf).rotate(270).toBuffer();
        const [p90, p270] = await Promise.all([pinkAtTop(cw90), pinkAtTop(cw270)]);
        buf = p270 > p90 ? cw270 : cw90;
        console.log(`[Preprocessor] Portrait → ${p270 > p90 ? "270°":"90°"} CW (p90=${p90.toFixed(3)} p270=${p270.toFixed(3)})`);
        meta = await sharp(buf).metadata();
    }

    if (wasPortrait && meta.width && meta.height && meta.width > meta.height) {
        const prelim = await cropToForm(buf, meta, true);
        const pm = await sharp(prelim).metadata();
        if (pm.width && pm.height && pm.width/pm.height < 1.15) {
            buf = await sharp(buf).rotate(90).toBuffer();
            meta = await sharp(buf).metadata();
            console.log("[Preprocessor] Form portrait-shaped in landscape — rotating +90°");
        }
    }

    buf = await cropToForm(buf, meta);
    meta = await sharp(buf).metadata();

    const processed = await sharp(buf)
        .resize(maxDimension, maxDimension, { fit:"inside", withoutEnlargement:true })
        .normalize().sharpen({ sigma: 1.0 }).jpeg({ quality }).toBuffer();

    return {
        buffer: processed,
        metadata: {
            originalWidth:  origMeta.width  || 0,
            originalHeight: origMeta.height || 0,
            originalFormat: origMeta.format || "jpeg",
            originalSize:   imageBuffer.length,
            wasPortrait,
            _raw: processed,
        },
    };
}

// ─── Prompts ──────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
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

function buildExtractionPrompt(pageNumber: number, pageTitle: string, questions: DiaryQuestion[]): string {
    const isSchedule = questions.some(q => q.type === "date" || q.type === "select");
    if (isSchedule) return buildSchedulePrompt(pageNumber, pageTitle);
    const fieldLines = questions.filter(q => q.type !== "info").map((q, i) => {
        if (q.type === "yes_no") return `  ${i+1}. "${q.id}" (yes_no): "${q.text}" → options: [Yes | No]`;
        if (q.type === "text")   return `  ${i+1}. "${q.id}" (text): "${q.text}" → read handwritten text or ""`;
        return `  ${i+1}. "${q.id}" (${q.type}): "${q.text}" → options: [${q.options?.join(" | ")||"Yes | No"}]`;
    }).join("\n");
    const exFields = questions.filter(q => q.type !== "info")
        .map(q => `    "${q.id}": { "value": <extracted_value_or_null>, "confidence": "high"|"medium"|"low" }`).join(",\n");
    return `This is CANTrac page ${pageNumber}: "${pageTitle}"
Extract the value of each field by examining which bubble is filled next to each question.
Fields to extract:\n${fieldLines}
Respond with ONLY this JSON (no markdown):\n{\n  "pageNumber": ${pageNumber},\n  "title": "${pageTitle}",\n  "fields": {\n${exFields}\n  }\n}`;
}

function buildSchedulePrompt(pageNumber: number, pageTitle: string): string {
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

The Second Attempt section may be completely blank. Also read "Next Appointment Required" (Yes/No) at the very bottom.

Reasoning must show your count (e.g. "L1:N=4,R=11,sum=16→05"):
{
  "pageNumber": ${pageNumber},
  "pageType": "schedule",
  "title": "${pageTitle}",
  "reasoning": {
    "first_dd": "<L1:N=?,R=?,sum=?→DD  or  L2:N=?,R=?,sum=?→DD>",
    "first_mm": "<N=?→Mon>",  "first_yy": "<which is solid>",  "first_status": "<which is solid>",
    "second_dd": "<same or blank>",  "second_mm": "<N=?→Mon or blank>",
    "second_yy": "<which or blank>", "second_status": "<which or blank>"
  },
  "fields": {
    "first_appointment_dd":      { "value": "<01-31 or null>", "confidence": "high|medium|low" },
    "first_appointment_mm":      { "value": "<Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec or null>", "confidence": "high|medium|low" },
    "first_appointment_yy":      { "value": "<2026|2027|2028 or null>", "confidence": "high|medium|low" },
    "first_appointment_status":  { "value": "<Scheduled|Completed|Missed|Cancelled or null>", "confidence": "high|medium|low" },
    "second_attempt_dd":         { "value": "<01-31 or null>", "confidence": "high|medium|low" },
    "second_attempt_mm":         { "value": "<Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec or null>", "confidence": "high|medium|low" },
    "second_attempt_yy":         { "value": "<2026|2027|2028 or null>", "confidence": "high|medium|low" },
    "second_attempt_status":     { "value": "<Scheduled|Completed|Missed|Cancelled or null>", "confidence": "high|medium|low" },
    "next_appointment_required": { "value": "<Yes|No or null>", "confidence": "high|medium|low" }
  }
}`;
}

// ─── Bilingual Rescan Tip (ported from cantrac-omr._generateRescanTip) ────

export function generateRescanTip(
    allRescanReasons: string[],
    warnings: string[],
    invalidFormReasons: string[],
    action: string
): RescanTip {
    const combined = [...allRescanReasons, ...warnings, ...invalidFormReasons].join(" ").toLowerCase();

    const notCantrac = combined.includes("does not appear to be a cantrac") || combined.includes("not a cantrac") ||
                       combined.includes("not appear to be a valid cantrac") ||
                       (action === "invalid_image" && combined.includes("does not appear"));
    if (notCantrac)
        return {
            english: "Please photograph a page from the CANTrac breast cancer diary — this image does not seem to be from the diary.",
            hindi:   "यह तस्वीर CANTrac डायरी की नहीं लग रही। कृपया अपनी CANTrac ब्रेस्ट कैंसर डायरी का सही पेज खोलकर दोबारा फोटो खींचें।",
        };

    const partialPage = combined.includes("page number") || combined.includes("top of the page") ||
                        combined.includes("full page") || combined.includes("entire page");
    if (partialPage)
        return {
            english: "Make sure the full page is in the photo, including the top part where the page number is printed — don't cut off any edges.",
            hindi:   "पूरा पेज कैमरे में आना चाहिए — खासकर ऊपर का हिस्सा जहाँ पेज नंबर छपा होता है। फोटो लेते समय कोई कोना या किनारा न कटे।",
        };

    const tips: Array<{ en: string; hi: string }> = [];
    if (combined.includes("patterned") || combined.includes("plain surface"))
        tips.push({ en: "place the diary page on a plain white surface", hi: "डायरी के पेज को किसी सादी और साफ़ सफेद जगह पर रखकर फोटो लें" });
    if (combined.includes("portrait orientation") || combined.includes("landscape"))
        tips.push({ en: "turn your phone sideways (landscape mode) to photograph the diary page", hi: "फोन को आड़ा (landscape) करके डायरी के पेज की फोटो खींचें" });
    if (combined.includes("angle") || combined.includes("directly above"))
        tips.push({ en: "hold your phone directly above the diary page", hi: "फोन को बिल्कुल सीधे ऊपर से पकड़ें, टेढ़ा न करें" });
    if (combined.includes("blur") || combined.includes("focus") || combined.includes("steady"))
        tips.push({ en: "hold your phone steady and let it focus before taking the photo", hi: "फोटो खींचते वक्त हाथ न हिलाएँ, थोड़ा रुककर फोकस होने दें" });
    if (combined.includes("lighting") || combined.includes("glare") || combined.includes("shadow"))
        tips.push({ en: "take the photo in bright, even lighting without shadows or glare", hi: "फोटो उजाले में लें — न बहुत अँधेरा हो, न तेज़ धूप या रोशनी से चमक आए" });
    if (combined.includes("cut off") || combined.includes("in frame") || combined.includes("edges"))
        tips.push({ en: "make sure the whole diary page is visible — don't cut off any edges", hi: "पूरा पेज फ्रेम में आना चाहिए, कोई हिस्सा कटा हुआ नहीं होना चाहिए" });
    if (combined.includes("inconsisten") || combined.includes("medium confidence") || combined.includes("inaccurate"))
        tips.push({ en: "ensure all bubbles are clearly visible and the diary page is in sharp focus", hi: "फोटो एकदम साफ़ होनी चाहिए ताकि सभी गोले (bubble) अच्छे से दिखें" });

    const selected = tips.slice(0, 2);
    if (selected.length === 0)
        return {
            english: "Retake the photo on a plain surface, held directly above the diary page, in good lighting.",
            hindi:   "किसी सादी और साफ़ जगह पर डायरी का पेज रखें, फोन को सीधे ऊपर से पकड़ें और अच्छी रोशनी में दोबारा फोटो खींचें।",
        };

    const enParts = selected.map(t => t.en);
    const hiParts = selected.map(t => t.hi);
    const english  = `To get a better reading: ${enParts[0].charAt(0).toUpperCase() + enParts[0].slice(1)}${enParts[1] ? ", and " + enParts[1] : ""}.`;
    const hindi    = hiParts.map(p => p.charAt(0).toUpperCase() + p.slice(1) + ".").join(" ");
    return { english, hindi };
}

// ─── Anthropic API Caller ─────────────────────────────────────────────────

interface CallOpts { model?: string; maxTokens?: number; }

async function callAnthropic(
    base64Image: string,
    userPrompt: string,
    apiKey: string,
    tracker: TokenTracker,
    opts: CallOpts = {}
): Promise<Record<string, any>> {
    const model     = opts.model     || ANTHROPIC_MODEL;
    const maxTokens = opts.maxTokens || MAX_TOKENS;
    const isHaiku   = model.includes("haiku");

    const body = {
        model, max_tokens: maxTokens,
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
    let response: Response;
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
    } catch (err: any) {
        clearTimeout(timer);
        if (err.name === "AbortError") throw new Error("Anthropic API timed out after 60 s");
        throw new Error(`Anthropic API network error: ${err.message}`);
    }
    clearTimeout(timer);

    if (!response.ok) {
        const errText = await response.text();
        if (response.status === 401) throw new Error("Anthropic API: invalid API key — set ANTHROPIC_API_KEY in .env");
        if (response.status === 429) throw new Error("Anthropic API: rate limit exceeded");
        throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }>; usage?: any };

    // Track token usage
    if (data.usage) {
        const inp = data.usage.input_tokens              || 0;
        const out = data.usage.output_tokens             || 0;
        const cw  = data.usage.cache_creation_input_tokens || 0;
        const cr  = data.usage.cache_read_input_tokens   || 0;
        tracker.calls++;
        if (isHaiku) { tracker.haikuInput += inp; tracker.haikuOutput += out; }
        else         { tracker.sonnetInput += inp; tracker.sonnetOutput += out; }
        tracker.cacheWriteTokens += cw;
        tracker.cacheReadTokens  += cr;
        if (cr > 0) console.log(`[Anthropic] Cache hit: ${cr} tokens (~$${((cr/1_000_000)*2.70).toFixed(4)} saved)`);
    }

    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("").trim();
    if (!text) throw new Error("Anthropic API returned empty response");
    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    const fixed   = cleaned.replace(/:\s*0+(\d+)/g, ": $1");
    try { return JSON.parse(fixed); }
    catch { throw new Error(`Failed to parse Anthropic response: ${cleaned.substring(0, 400)}`); }
}

function calcTokenUsage(t: TokenTracker): CantracTokenUsage {
    const inputTokens  = t.sonnetInput  + t.haikuInput;
    const outputTokens = t.sonnetOutput + t.haikuOutput;
    const totalTokens  = inputTokens + outputTokens + t.cacheWriteTokens + t.cacheReadTokens;
    const estimatedCostUSD = parseFloat((
        (t.sonnetInput  / 1_000_000) * 3.00  +
        (t.sonnetOutput / 1_000_000) * 15.00 +
        (t.haikuInput   / 1_000_000) * 0.80  +
        (t.haikuOutput  / 1_000_000) * 4.00  +
        (t.cacheWriteTokens / 1_000_000) * 3.75 +
        (t.cacheReadTokens  / 1_000_000) * 0.30
    ).toFixed(6));
    return { apiCalls: t.calls, inputTokens, outputTokens, cacheWriteTokens: t.cacheWriteTokens, cacheReadTokens: t.cacheReadTokens, totalTokens, estimatedCostUSD };
}

// ─── Schedule Helper ──────────────────────────────────────────────────────

const NUM_TO_MONTH: Record<string, string> = {
    "01":"Jan","02":"Feb","03":"Mar","04":"Apr","05":"May","06":"Jun",
    "07":"Jul","08":"Aug","09":"Sep","10":"Oct","11":"Nov","12":"Dec",
};

/** Normalise any month representation to a 3-letter abbreviation (e.g. "apr" → "Apr", "04" → "Apr"). */
function toMonthAbbr(mm: string): string | null {
    const title = mm.charAt(0).toUpperCase() + mm.slice(1).toLowerCase();
    if (VALID_MONTHS.includes(title)) return title;                    // already a valid abbreviation
    const fromNum = NUM_TO_MONTH[mm.padStart(2, "0")];
    return fromNum ?? null;
}

/** Returns "DD/MMM/YYYY" (e.g. "12/Jun/2026"). */
function assembleDateString(dd: string | null, mm: string | null, yy: string | null): string | null {
    if (!dd || !mm || !yy) return null;
    const mmAbbr = toMonthAbbr(mm);
    if (!mmAbbr) return null;
    return `${dd.padStart(2,"0")}/${mmAbbr}/${yy}`;
}

// ─── Retry Prompts ────────────────────────────────────────────────────────

const buildDDMMRetry = (label: string) =>
    `Focus ONLY on the "${label}" section of this CANTrac diary page.
Read BOTH rows:
DD row — TWO lines: Line 1 has 16 bubbles (days 01-16), Line 2 has 15 bubbles (days 17-31). Count N empty left + R empty right. Line 1: day=N+1. Line 2: day=N+17. Zero-pad.
MM row — 12 bubbles: Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec. Count N empty left. N=0→Jan…N=11→Dec. Check Oct/Nov/Dec carefully.
Respond with ONLY this JSON: { "dd": "<01-31>", "dd_confidence": "high|medium|low", "mm": "<Jan|...|Dec|null>", "mm_confidence": "high|medium|low" }`;

const buildDDRetry = (label: string, cur: string | null, plus1: string | null) =>
    plus1 ? `Focus on "${label}". Compare ONLY these two adjacent DD bubbles: day ${cur} and day ${plus1}. Which is DARKER?
Respond: { "dd": "<${cur}|${plus1}>", "confidence": "high|medium|low" }`
    : `Focus on "${label}". DD row — TWO lines: Line 1 (01-16), Line 2 (17-31). Count N empty left. Line 1: day=N+1, Line 2: day=N+17. Zero-pad.
Respond: { "dd": "<01-31>", "confidence": "high|medium|low" }`;

const buildMMRetry = (label: string, hasData: boolean) =>
    `Focus on "${label}". MM row — 12 bubbles: Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec. Count N empty left → N=0→Jan…N=11→Dec.${hasData ? " Other fields in this section are filled, so a month IS selected." : ""} Return null only if section is completely blank.
Respond: { "mm": "<Jan|...|Dec|null>", "confidence": "high|medium|low" }`;

const buildYYBothRetry = () =>
    `Look at the YEAR rows in BOTH appointment sections on this CANTrac schedule page.
Each YY row has exactly 3 bubbles: LEFTMOST=2026, MIDDLE=2027, RIGHTMOST=2028. ONE is SOLID dark.
WARNING: Leftmost (2026) and rightmost (2028) are easy to confuse — examine each SEPARATELY.
Respond: { "first_yy": "<2026|2027|2028>", "first_yy_confidence": "...", "second_yy": "<2026|2027|2028|null>", "second_yy_confidence": "..." }`;

const buildYYSingleRetry = (label: string) =>
    `Look at the YEAR row in the "${label}" section. 3 bubbles: LEFTMOST=2026, MIDDLE=2027, RIGHTMOST=2028. Which ONE is SOLID dark inside?
Respond: { "yy": "<2026|2027|2028>", "confidence": "high|medium|low" }`;

const buildSecondSectionRetry = (fDD: string, fMM: string, fYY: string) =>
    `Re-read ONLY the SECOND ATTEMPT (bottom) section. First appointment: ${fMM} ${fDD}, ${fYY}. Expect second attempt year to be ${fYY} (or at most ${parseInt(fYY)+1}).
DD: Check Line 2 (17-31) first, then Line 1 (01-16). MM: 12 bubbles Jan-Dec. YY: LEFTMOST=2026, MIDDLE=2027, RIGHTMOST=2028. Status: Scheduled/Completed/Missed/Cancelled.
If blank, return null for all.
Respond: { "second_attempt_dd": {"value":"<01-31 or null>","confidence":"..."}, "second_attempt_mm": {"value":"<Jan|...|Dec or null>","confidence":"..."}, "second_attempt_yy": {"value":"<2026|2027|2028 or null>","confidence":"..."}, "second_attempt_status": {"value":"<...or null>","confidence":"..."} }`;

// ─── Cross-Validation ─────────────────────────────────────────────────────

async function crossValidate(
    base64: string, apiKey: string,
    fields: Record<string, AnthropicField>,
    tracker: TokenTracker, warnings: string[]
): Promise<boolean> {
    const cur = new Date().getFullYear();
    const fMM = fields["first_appointment_mm"]?.value  ?? null;
    const fYY = fields["first_appointment_yy"]?.value  ?? null;
    const sMM = fields["second_attempt_mm"]?.value     ?? null;
    const sYY = fields["second_attempt_yy"]?.value     ?? null;
    const fSt = fields["first_appointment_status"]?.value ?? null;

    const issues: string[] = [];
    if (["Completed","Missed","Cancelled"].includes(fSt ?? "") && fYY && parseInt(fYY) > cur) issues.push("first_yy_future");
    if (fMM && sMM && fMM === sMM) issues.push("same_mm");
    if (fYY && sYY && fYY === sYY && ["Completed","Missed","Cancelled"].includes(fSt ?? "")) issues.push("same_yy_terminal");
    if (issues.length === 0) return false;

    console.log(`[Anthropic] Cross-validation issues: ${issues.join(", ")}`);
    const notes: string[] = [];
    if (issues.includes("first_yy_future")) notes.push(`ERROR: Status '${fSt}' but year ${fYY} is in the future (current: ${cur}). LEFTMOST bubble (2026) is almost certainly correct.`);
    if (issues.includes("same_mm")) notes.push(`ERROR: Both sections show the same month (${fMM}). Each section has its OWN separate MM row.`);
    if (issues.includes("same_yy_terminal") && !issues.includes("first_yy_future")) notes.push(`ERROR: Both sections show year ${fYY} when first is '${fSt}'. Read each section's YY row independently.`);

    const prompt = `CANTrac schedule page — KNOWN ERRORS — correct them:\n${notes.join("\n\n")}
Re-read ONLY these 4 values independently for TOP (First Appointment) and BOTTOM (Second Attempt) sections.
Respond: { "reasoning": { "first_mm":"...", "first_yy":"...", "second_mm":"...", "second_yy":"..." }, "first_mm":"...", "first_yy":"...", "second_mm":"...", "second_yy":"..." }`;

    try {
        const c = await callAnthropic(base64, prompt, apiKey, tracker);
        const applied: string[] = [];
        if (c.first_mm && VALID_MONTHS.includes(c.first_mm) && c.first_mm !== fMM) { fields["first_appointment_mm"] = { value: c.first_mm, confidence: "medium" }; applied.push(`first_mm=${c.first_mm}`); }
        if (c.first_yy && VALID_YEARS.includes(String(c.first_yy))) {
            const cy = String(c.first_yy);
            if (cy !== fYY && (parseInt(cy) <= cur && parseInt(fYY||"0") > cur || issues.includes("same_yy_terminal"))) {
                fields["first_appointment_yy"] = { value: cy, confidence: "medium" }; applied.push(`first_yy=${cy}`);
            }
        }
        if (c.second_mm && VALID_MONTHS.includes(c.second_mm) && c.second_mm !== sMM) { fields["second_attempt_mm"] = { value: c.second_mm, confidence: "medium" }; applied.push(`second_mm=${c.second_mm}`); }
        if (c.second_yy && VALID_YEARS.includes(String(c.second_yy)) && String(c.second_yy) !== sYY) { fields["second_attempt_yy"] = { value: String(c.second_yy), confidence: "medium" }; applied.push(`second_yy=${c.second_yy}`); }
        warnings.push(applied.length > 0 ? `Cross-validation corrected: ${applied.join(", ")}` : "Cross-validation re-read did not change values — manual verification recommended");
    } catch (err: any) { console.log(`[Anthropic] Cross-validation failed: ${err.message}`); }
    return true;
}

// ─── Image Quality + Form Validity ────────────────────────────────────────

async function checkFormValidity(lowRes: string, apiKey: string, tracker: TokenTracker): Promise<{ valid: boolean; reason?: string }> {
    try {
        const r = await callAnthropic(lowRes,
            `Is this a CANTrac breast cancer tracking diary page? A valid page has: pink/red header banner, bubble rows, page number at top center, ribbon symbol, QR code.
Respond: { "isValid": true|false, "reason": "<one sentence>" }`,
            apiKey, tracker, { model: HAIKU_MODEL, maxTokens: 256 });
        if (typeof r.isValid === "boolean") return { valid: r.isValid, reason: r.reason };
    } catch (err: any) { console.log(`[Anthropic] Form validity check failed: ${err.message}`); }
    return { valid: true };
}

async function assessImageQuality(lowRes: string, apiKey: string, tracker: TokenTracker, warnings: string[]): Promise<void> {
    try {
        const q = await callAnthropic(lowRes,
            `Assess photographic quality of this CANTrac diary page photo.
Check: patterned/textured background, severe angle/skew, blur/out-of-focus, poor lighting/glare, form edges cut off.
Respond: { "patterned_background":bool, "severe_angle":bool, "blurry":bool, "poor_lighting":bool, "form_cut_off":bool, "overall_quality":"good"|"acceptable"|"poor" }`,
            apiKey, tracker, { model: HAIKU_MODEL, maxTokens: 256 });
        const issues: string[] = [];
        if (q.patterned_background) issues.push("diary page is on a patterned background — use a plain surface");
        if (q.severe_angle)         issues.push("diary page is photographed at a severe angle — hold camera directly above");
        if (q.blurry)               issues.push("image is blurry — hold steady and let it focus");
        if (q.poor_lighting)        issues.push("poor lighting or glare — improve lighting");
        if (q.form_cut_off)         issues.push("diary page edges cut off — ensure the whole page is in frame");
        if (issues.length > 0) { warnings.push("Image quality issues detected: " + issues.join("; ") + " — retake recommended for accuracy"); console.log(`[Anthropic] Quality issues: ${issues.join(", ")}`); }
        if (q.overall_quality === "poor") warnings.push("Overall image quality is poor — retake the photo");
        else if (q.overall_quality === "acceptable" && issues.length > 0) warnings.push("Image quality is marginal — retake recommended to improve accuracy");
    } catch (err: any) { console.log(`[Anthropic] Quality check failed: ${err.message}`); }
}

// ─── Main Export ──────────────────────────────────────────────────────────

export async function extractWithAnthropic(
    imageBuffer: Buffer,
    pageNumber: number,
    pageTitle: string,
    questions: DiaryQuestion[]
): Promise<AnthropicExtractionResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set in environment variables");

    const startTime  = Date.now();
    const warnings:  string[] = [];
    const tracker    = makeTracker();
    const isSchedule = questions.some(q => q.type === "date" || q.type === "select");

    // Preprocess (standard or high-res for schedule pages, low-res for Haiku checks)
    const [mainPrep, lowResPrep] = await Promise.all([
        preprocessForVision(imageBuffer, isSchedule ? SCHED_MAX_DIM : STD_MAX_DIM, isSchedule ? SCHED_QUALITY : STD_QUALITY),
        preprocessForVision(imageBuffer, LOWRES_MAX, LOWRES_QUAL),
    ]);
    const base64    = mainPrep.buffer.toString("base64");
    const lowRes64  = lowResPrep.buffer.toString("base64");

    // Collect image metadata using sharp on processed buffer
    const processedMeta = await sharp(mainPrep.buffer).metadata();
    const imageMetadata: ImageMetadata = {
        originalWidth:    mainPrep.metadata.originalWidth,
        originalHeight:   mainPrep.metadata.originalHeight,
        originalFormat:   mainPrep.metadata.originalFormat,
        originalSize:     imageBuffer.length,
        processedWidth:   processedMeta.width  || 0,
        processedHeight:  processedMeta.height || 0,
        processedSize:    mainPrep.buffer.length,
        compressionRatio: ((1 - mainPrep.buffer.length / imageBuffer.length) * 100).toFixed(1) + "%",
        wasPortrait:      mainPrep.metadata.wasPortrait,
    };

    // Form validity check via Haiku (cheap, non-blocking)
    const { valid: isValidCantracForm, reason: invalidReason } = await checkFormValidity(lowRes64, apiKey, tracker);
    if (!isValidCantracForm) {
        warnings.push(`Image may not be a valid CANTrac diary page: ${invalidReason || "unknown"}`);
        console.log(`[Anthropic] Form invalid: ${invalidReason}`);
    }

    // Main extraction
    const rawResult = await callAnthropic(base64, buildExtractionPrompt(pageNumber, pageTitle, questions), apiKey, tracker) as AnthropicRawResult;
    if (rawResult.reasoning) { console.log("[Anthropic] Reasoning:", JSON.stringify(rawResult.reasoning, null, 2)); delete rawResult.reasoning; }

    // ── Schedule: component-level retries ────────────────────────────────
    let crossValidationFired = false;
    let secondRetryChanged   = false;

    if (isSchedule && rawResult.fields) {
        const SECTIONS = [
            { prefix: "first_appointment" as const, label: "First Appointment" },
            { prefix: "second_attempt"    as const, label: "Second Attempt (If First Missed/Cancelled)" },
        ];
        const nearEndApplied = new Set<string>();

        for (const { prefix, label } of SECTIONS) {
            const ddKey = `${prefix}_dd`; const mmKey = `${prefix}_mm`;
            const ddF = rawResult.fields[ddKey]; const mmF = rawResult.fields[mmKey];
            const ddVal  = parseInt(ddF?.value || "0");
            const nearEnd = (ddVal >= 14 && ddVal <= 16) || (ddVal >= 26 && ddVal <= 31);
            const ddBad   = !ddF || ddF.value === null || ddF.confidence === "low" || nearEnd;
            const mmBad   = !mmF || mmF.value === null || mmF.confidence === "low";

            if (ddBad && !nearEnd && mmBad) {
                console.log(`[Anthropic] DD+MM both bad for ${label} — combined retry`);
                try {
                    const c = await callAnthropic(base64, buildDDMMRetry(label), apiKey, tracker);
                    if (c.dd) rawResult.fields[ddKey] = { value: String(c.dd).padStart(2,"0"), confidence: c.dd_confidence || "medium" };
                    const mv = c.mm && c.mm !== "null" ? c.mm : null;
                    if (mv) rawResult.fields[mmKey] = { value: mv, confidence: c.mm_confidence || "medium" };
                    else warnings.push(`MM for ${label} could not be read — manual verification required`);
                } catch (e: any) { console.log(`[Anthropic] DD+MM retry failed: ${e.message}`); }
                continue;
            }

            if (ddBad) {
                const plus1 = Math.min(ddVal+1, ddVal <= 16 ? 16 : 31);
                const p1Str = nearEnd && plus1 > ddVal ? String(plus1).padStart(2,"0") : null;
                console.log(`[Anthropic] DD=${ddF?.value ?? "null"} for ${label}${nearEnd ? " [near-end]":""} — retrying`);
                try {
                    const r = await callAnthropic(base64, buildDDRetry(label, ddF?.value ?? null, p1Str), apiKey, tracker);
                    if (r.dd) {
                        const padded = String(r.dd).padStart(2,"0");
                        if (nearEnd && padded === ddF?.value && p1Str && plus1 > ddVal) {
                            warnings.push(`DD=${padded} auto-corrected to ${p1Str} (near-end bias) — verify manually`);
                            rawResult.fields[ddKey] = { value: p1Str, confidence: "low" };
                        } else { rawResult.fields[ddKey] = { value: padded, confidence: r.confidence || "medium" }; }
                        if (nearEnd) nearEndApplied.add(ddKey);
                    }
                } catch (e: any) { console.log(`[Anthropic] DD retry failed: ${e.message}`); }
            }

            if (mmBad) {
                const hasData = rawResult.fields[ddKey]?.value != null;
                console.log(`[Anthropic] MM=${mmF?.value ?? "null"} for ${label} — retrying`);
                try {
                    const r = await callAnthropic(base64, buildMMRetry(label, hasData), apiKey, tracker);
                    const mv = r?.mm && r.mm !== "null" ? r.mm : null;
                    if (mv) rawResult.fields[mmKey] = { value: mv, confidence: r.confidence || "medium" };
                    else warnings.push(`MM for ${label} could not be read — manual verification required`);
                } catch (e: any) { console.log(`[Anthropic] MM retry failed: ${e.message}`); }
            }
        }

        // YY retry
        const hasSecondData = rawResult.fields["second_attempt_dd"]?.value != null || rawResult.fields["second_attempt_mm"]?.value != null;
        const fYYF = rawResult.fields["first_appointment_yy"]; const sYYF = rawResult.fields["second_attempt_yy"];
        const fYYBad = !fYYF || fYYF.value === null || fYYF.confidence !== "high";
        const sYYBad = hasSecondData && (!sYYF || sYYF.value === null || sYYF.confidence !== "high");

        if (fYYBad && sYYBad) {
            console.log("[Anthropic] YY bad for both sections — combined retry");
            try {
                const c = await callAnthropic(base64, buildYYBothRetry(), apiKey, tracker);
                if (c.first_yy  && VALID_YEARS.includes(String(c.first_yy)))  rawResult.fields["first_appointment_yy"] = { value: String(c.first_yy),  confidence: c.first_yy_confidence  || "medium" };
                if (c.second_yy && VALID_YEARS.includes(String(c.second_yy))) rawResult.fields["second_attempt_yy"]    = { value: String(c.second_yy), confidence: c.second_yy_confidence || "medium" };
            } catch (e: any) { console.log(`[Anthropic] YY combined retry failed: ${e.message}`); }
        } else {
            for (const { key, label, field } of [
                fYYBad ? { key: "first_appointment_yy", label: "First Appointment", field: fYYF } : null,
                sYYBad ? { key: "second_attempt_yy",    label: "Second Attempt",    field: sYYF } : null,
            ].filter(Boolean) as Array<{ key: string; label: string; field: AnthropicField | undefined }>) {
                console.log(`[Anthropic] YY=${field?.value ?? "null"} for ${label} — retrying`);
                try {
                    const r = await callAnthropic(base64, buildYYSingleRetry(label), apiKey, tracker);
                    if (r.yy && VALID_YEARS.includes(String(r.yy))) rawResult.fields[key] = { value: String(r.yy), confidence: r.confidence || "medium" };
                } catch (e: any) { console.log(`[Anthropic] YY retry failed: ${e.message}`); }
            }
        }

        // Second section retry (year gap / terminal status)
        const fDD = rawResult.fields["first_appointment_dd"]?.value; const fMM = rawResult.fields["first_appointment_mm"]?.value;
        const fYY = rawResult.fields["first_appointment_yy"]?.value; const sYY = rawResult.fields["second_attempt_yy"]?.value;
        const sDd = rawResult.fields["second_attempt_dd"]?.value;     const sMm = rawResult.fields["second_attempt_mm"]?.value;
        const fSt = rawResult.fields["first_appointment_status"]?.value;
        const yearGap = fYY && sYY && Math.abs(parseInt(sYY) - parseInt(fYY)) > 1;
        const secondHasData = sDd != null || sMm != null;
        if (yearGap || (["Completed","Missed","Cancelled"].includes(fSt ?? "") && secondHasData)) {
            console.log(`[Anthropic] ${yearGap ? `Year gap (${fYY} vs ${sYY})` : `First status='${fSt}'`} — retrying second section`);
            try {
                const retried = await callAnthropic(base64, buildSecondSectionRetry(fDD||"", fMM||"", fYY||""), apiKey, tracker);
                const origGap  = fYY ? Math.abs(parseInt(sYY||"0")                              - parseInt(fYY)) : 0;
                const retryGap = fYY ? Math.abs(parseInt(retried["second_attempt_yy"]?.value||"0") - parseInt(fYY)) : 0;
                const curYear  = new Date().getFullYear();
                if (yearGap && retryGap > origGap && retryGap > 1) warnings.push("Second attempt retry rejected — year gap worse");
                else if (parseInt(retried["second_attempt_yy"]?.value||"0") > curYear + 1) warnings.push("Second attempt retry rejected — year implausibly far in future");
                else {
                    for (const k of ["second_attempt_dd","second_attempt_mm","second_attempt_yy","second_attempt_status"] as const) {
                        if (k === "second_attempt_dd" && nearEndApplied.has(k)) continue;
                        if (retried[k]?.value !== null && retried[k]?.value !== undefined) {
                            if (retried[k].value !== rawResult.fields[k]?.value) secondRetryChanged = true;
                            rawResult.fields[k] = retried[k];
                        }
                    }
                }
            } catch (e: any) { console.log(`[Anthropic] Second section retry failed: ${e.message}`); }
        }

        // Cross-validation
        crossValidationFired = await crossValidate(base64, apiKey, rawResult.fields, tracker, warnings);

        if (crossValidationFired) warnings.push("Logical inconsistencies detected in date fields — values may still be inaccurate despite auto-correction");
        if (secondRetryChanged)   warnings.push("Second attempt section required re-extraction — initial read was incorrect, verify values");
    }

    // Image quality (Haiku, run in background — don't await)
    assessImageQuality(lowRes64, apiKey, tracker, warnings).catch(() => {});

    // Portrait warning
    if (imageMetadata.wasPortrait) warnings.push("Photo was taken in portrait orientation of a landscape diary page — extraction accuracy may be reduced");

    // ── Map cantracFields → AIExtractionResult (DiaryPage question IDs) ──
    const cantracFields: Record<string, AnthropicField> = rawResult.fields || {};
    const extraction: AIExtractionResult = {};

    if (isSchedule) {
        const dateQs   = questions.filter(q => q.type === "date");
        const statusQs = questions.filter(q => q.type === "select");
        const yesNoQs  = questions.filter(q => q.type === "yes_no");
        const datePfx  = ["first_appointment", "second_attempt"] as const;
        const stsPfx   = ["first_appointment_status", "second_attempt_status"] as const;

        for (let i = 0; i < dateQs.length; i++) {
            const q = dateQs[i]; const pfx = datePfx[i];
            if (!pfx) { extraction[q.id] = { value: null, confidence: 0 }; continue; }
            const dd = cantracFields[`${pfx}_dd`]?.value ?? null;
            const mm = cantracFields[`${pfx}_mm`]?.value ?? null;
            const yy = cantracFields[`${pfx}_yy`]?.value ?? null;
            const minConf = Math.min(
                CONFIDENCE_MAP[cantracFields[`${pfx}_dd`]?.confidence ?? ""] ?? 0,
                CONFIDENCE_MAP[cantracFields[`${pfx}_mm`]?.confidence ?? ""] ?? 0,
                CONFIDENCE_MAP[cantracFields[`${pfx}_yy`]?.confidence ?? ""] ?? 0,
            );
            extraction[q.id] = { value: assembleDateString(dd, mm, yy), confidence: minConf || 0 };
        }
        for (let i = 0; i < statusQs.length; i++) {
            const q = statusQs[i]; const fk = stsPfx[i];
            if (!fk) { extraction[q.id] = { value: null, confidence: 0 }; continue; }
            const raw = cantracFields[fk];
            extraction[q.id] = { value: raw?.value ?? null, confidence: CONFIDENCE_MAP[raw?.confidence ?? ""] ?? 0 };
        }
        const nar = cantracFields["next_appointment_required"];
        if (yesNoQs[0] && nar) {
            let val = nar.value;
            if (val) val = val.toLowerCase().startsWith("y") ? "yes" : val.toLowerCase().startsWith("n") ? "no" : val;
            extraction[yesNoQs[0].id] = { value: val, confidence: CONFIDENCE_MAP[nar.confidence ?? ""] ?? 0 };
        }
    } else {
        for (const q of questions) {
            if (q.type === "info") continue;
            const raw = cantracFields[q.id];
            if (raw) {
                let value = raw.value ?? null;
                if (q.type === "yes_no" && value) {
                    const l = value.toLowerCase().trim();
                    if      (["yes","हाँ","y","true"].includes(l))  value = "yes";
                    else if (["no","नहीं","n","false"].includes(l)) value = "no";
                }
                extraction[q.id] = { value, confidence: CONFIDENCE_MAP[raw.confidence ?? "medium"] ?? 0.75 };
                if (raw.confidence === "low") warnings.push(`Low confidence on "${q.id}": ${q.text}`);
            } else {
                warnings.push(`Field "${q.id}" not returned by Anthropic`);
                extraction[q.id] = { value: null, confidence: 0 };
            }
        }
    }

    // Compute final confidence
    const scores = Object.values(extraction).map(f => f.confidence).filter(c => c > 0);
    const overallConfidence = scores.length
        ? Math.round((scores.reduce((a,b) => a+b, 0) / scores.length) * 100) / 100 : 0;

    // Build rescan tip (bilingual)
    const lowConfCount = Object.values(extraction).filter(f => f.confidence < 0.5 && f.confidence > 0).length;
    const allRescanReasons: string[] = [...warnings.filter(w =>
        w.includes("quality") || w.includes("retake") || w.includes("patterned") ||
        w.includes("angle") || w.includes("portrait orientation") || w.includes("blur") ||
        w.includes("cut off") || w.includes("lighting") || w.includes("glare") ||
        w.includes("inconsisten") || w.includes("medium confidence") || w.includes("inaccurate")
    )];
    if (lowConfCount > 0) allRescanReasons.unshift(`${lowConfCount} field(s) have low confidence — verify manually`);

    const action = !isValidCantracForm ? "invalid_image" : allRescanReasons.length > 0 ? "rescan_required" : "success";
    const rescanTip = action !== "success"
        ? generateRescanTip(allRescanReasons, warnings, isValidCantracForm ? [] : [`Image may not be a valid CANTrac diary page`], action)
        : null;

    const tokenUsage = calcTokenUsage(tracker);
    const processingTimeMs = Date.now() - startTime;

    console.log(`[Anthropic] Page ${pageNumber} done — conf=${overallConfidence}, ${tokenUsage.apiCalls} calls, $${tokenUsage.estimatedCostUSD}, ${processingTimeMs}ms`);

    return { extraction, processingTimeMs, overallConfidence, warnings, cantracFields, rescanTip, isValidCantracForm, imageMetadata, tokenUsage };
}

export function isAnthropicConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
}
