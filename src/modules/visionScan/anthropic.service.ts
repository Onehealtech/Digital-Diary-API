/**
 * Anthropic Claude Vision Extraction Service
 *
 * Ports the cantrac-omr image processing + Anthropic API approach into the
 * Digital Diary API pipeline. Uses:
 *   - Sharp preprocessing  (auto-rotate, resize, normalize, sharpen)
 *   - Anthropic claude-sonnet-4-6 via direct HTTP (same as cantrac-omr)
 *   - Diary page questions from the database (not hardcoded templates)
 *   - Returns AIExtractionResult — identical format to the existing pipeline
 */

import sharp from "sharp";
import { AIExtractionResult, DiaryQuestion } from "./visionScan.types";

// ─── Config ────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL   = process.env.ANTHROPIC_MODEL || "claude-opus-4-6";
const MAX_TOKENS        = 2048;

// Standard pages: 1600px / q=85  |  Schedule pages (tiny date bubbles): 3000px / q=95
const STD_MAX_DIM  = 1600;
const STD_QUALITY  = 85;
const SCHED_MAX_DIM = 3000;
const SCHED_QUALITY = 95;

// Confidence string → numeric mapping
const CONFIDENCE_MAP: Record<string, number> = {
    high:   0.95,
    medium: 0.75,
    low:    0.45,
};

// ─── Types ─────────────────────────────────────────────────────────────────

interface AnthropicField {
    value: string | null;
    confidence: "high" | "medium" | "low";
}

interface AnthropicRawResult {
    pageNumber?: number;
    pageType?:   string;
    title?:      string;
    fields:      Record<string, AnthropicField>;
}

export interface AnthropicExtractionResult {
    extraction:    AIExtractionResult;
    processingTimeMs: number;
    overallConfidence: number;
    warnings: string[];
}

// ─── Image Preprocessing ──────────────────────────────────────────────────

/**
 * Preprocess phone photo for optimal vision API extraction.
 * Ported directly from cantrac-omr/src/utils/image-preprocessor.js
 */
async function preprocessForVision(
    imageBuffer: Buffer,
    maxDimension: number = STD_MAX_DIM,
    quality: number = STD_QUALITY
): Promise<Buffer> {
    return sharp(imageBuffer)
        .rotate()                                    // Auto-rotate via EXIF
        .resize(maxDimension, maxDimension, {
            fit: "inside",
            withoutEnlargement: true,
        })
        .normalize()                                 // Stretch contrast
        .sharpen({ sigma: 1.0 })                    // Mild sharpening
        .jpeg({ quality })
        .toBuffer();
}

// ─── Prompt Building ──────────────────────────────────────────────────────

function buildSystemPrompt(): string {
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

function buildPageIdentificationPrompt(): string {
    return `Look at this CANTrac breast cancer diary page.

Read ONLY the page number printed at the top center and the page title.

Respond with ONLY this JSON (no markdown, no backticks):
{
  "pageNumber": <number>,
  "title": "<English title>"
}`;
}

function buildExtractionPrompt(
    pageNumber: number,
    pageTitle: string,
    questions: DiaryQuestion[]
): string {
    const isSchedule = questions.some(q => q.type === "date" || q.type === "select");

    if (isSchedule) {
        return buildSchedulePrompt(pageNumber, pageTitle);
    }

    const fieldLines = questions
        .filter(q => q.type !== "info")
        .map((q, i) => {
            if (q.type === "yes_no") {
                return `  ${i + 1}. "${q.id}" (yes_no): "${q.text}" → options: [Yes | No]`;
            }
            if (q.type === "text") {
                return `  ${i + 1}. "${q.id}" (text): "${q.text}" → read handwritten text or ""`;
            }
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

function buildSchedulePrompt(pageNumber: number, pageTitle: string): string {
    return `This is CANTrac page ${pageNumber}: "${pageTitle}"

This is a SCHEDULE PAGE with appointment dates. It has TWO appointment sections and a final question.

Look at this form carefully. For each section, tell me what date and status are selected by reading which bubbles are filled in with dark ink.

SECTION 1: "First Appointment" (top section)
- What DAY (DD) is selected? The DD row has numbers 01-31. Which number has a DARK FILLED bubble? Report as two digits, e.g. "05", "14", "22".
- What MONTH (MM) is selected? The month row shows: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec. Which month has a dark filled bubble?
- What YEAR (YY) is selected? Options are 2026, 2027, 2028. Which year has a dark filled bubble?
- What STATUS is selected? Options are: Scheduled, Completed, Missed, Cancelled. Which one has a dark filled bubble?

SECTION 2: "Second Attempt (If First Missed/Cancelled)" (bottom section)
- Same structure: DD (01-31), MM (Jan-Dec), YY (2026/2027/2028), Status (Scheduled/Completed/Missed/Cancelled)
- This section may be blank if no second attempt was needed.

FINAL QUESTION: "Next Appointment Required" — Yes or No bubble at the very bottom.

IMPORTANT TIPS FOR READING BUBBLES:
- FILLED = dark solid circle (blue, purple, or black ink inside)
- EMPTY = light circle with just an outline, or very faint gray
- The filled bubbles are SMALL but clearly darker than the empty ones around them
- Some DD numbers may be hard to read — count the position from 01 to determine which number it is

Respond with ONLY this JSON (no markdown, no backticks):
{
  "pageNumber": ${pageNumber},
  "title": "${pageTitle}",
  "fields": {
    "q1_date": { "value": "<DD/MM/YY or null>", "confidence": "high|medium|low" },
    "q1_status": { "value": "<Scheduled|Completed|Missed|Cancelled or null>", "confidence": "high|medium|low" },
    "q2_date": { "value": "<DD/MM/YY or null>", "confidence": "high|medium|low" },
    "q2_status": { "value": "<Scheduled|Completed|Missed|Cancelled or null>", "confidence": "high|medium|low" },
    "q3": { "value": "<Yes|No or null>", "confidence": "high|medium|low" }
  }
}`;
}

// ─── Anthropic API Call ────────────────────────────────────────────────────

async function callAnthropicAPI(
    base64Image: string,
    systemPrompt: string,
    userPrompt: string,
    apiKey: string
): Promise<AnthropicRawResult> {
    const body = {
        model:      ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        system:     systemPrompt,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image",
                        source: {
                            type:       "base64",
                            media_type: "image/jpeg",
                            data:       base64Image,
                        },
                    },
                    {
                        type: "text",
                        text: userPrompt,
                    },
                ],
            },
        ],
    };

    const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
            "Content-Type":    "application/json",
            "x-api-key":       apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }

    const data = await response.json() as { content: Array<{ type: string; text: string }> };

    const text = data.content
        ?.filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

    if (!text) throw new Error("Anthropic API returned empty response");

    const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    // Fix leading zeros in JSON number values (e.g. "value": 012 → "value": 12)
    const fixed = cleaned.replace(/:\s*0+(\d+)/g, ": $1");

    try {
        return JSON.parse(fixed) as AnthropicRawResult;
    } catch {
        throw new Error(
            `Failed to parse Anthropic response as JSON: ${cleaned.substring(0, 500)}`
        );
    }
}

// ─── Main Export ──────────────────────────────────────────────────────────

/**
 * Extract diary page fields using Anthropic Claude Vision.
 * Drop-in replacement for the OpenRouter LLM path in visionScan.service.ts.
 *
 * @param imageBuffer  Raw image buffer from upload
 * @param pageNumber   Detected page number
 * @param pageTitle    Page title (from DB)
 * @param questions    Diary page questions (from DB)
 * @returns AnthropicExtractionResult with extraction in AIExtractionResult format
 */
export async function extractWithAnthropic(
    imageBuffer: Buffer,
    pageNumber: number,
    pageTitle: string,
    questions: DiaryQuestion[]
): Promise<AnthropicExtractionResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
    }

    const startTime = Date.now();
    const warnings: string[] = [];
    const isSchedule = questions.some(q => q.type === "date" || q.type === "select");

    // Preprocess image — higher resolution for schedule pages
    const processedBuffer = await preprocessForVision(
        imageBuffer,
        isSchedule ? SCHED_MAX_DIM : STD_MAX_DIM,
        isSchedule ? SCHED_QUALITY : STD_QUALITY
    );
    const base64Image = processedBuffer.toString("base64");

    // Build prompts and call API
    const systemPrompt = buildSystemPrompt();
    const userPrompt   = buildExtractionPrompt(pageNumber, pageTitle, questions);
    const rawResult    = await callAnthropicAPI(base64Image, systemPrompt, userPrompt, apiKey);

    // Map cantrac-omr field format → AIExtractionResult format
    const extraction: AIExtractionResult = {};

    for (const question of questions) {
        if (question.type === "info") continue;

        const raw = rawResult.fields?.[question.id];

        if (raw) {
            const confidenceStr = raw.confidence || "medium";
            const confidence = CONFIDENCE_MAP[confidenceStr] ?? 0.75;

            // Normalize yes/no values to lowercase
            let value: string | null = raw.value ?? null;
            if (question.type === "yes_no" && value) {
                const lower = value.toLowerCase().trim();
                if (["yes", "हाँ", "y", "true"].includes(lower)) value = "yes";
                else if (["no", "नहीं", "n", "false"].includes(lower)) value = "no";
            }

            extraction[question.id] = { value, confidence };

            if (confidenceStr === "low") {
                warnings.push(`Low confidence on field "${question.id}": ${question.text}`);
            }
        } else {
            warnings.push(`Field "${question.id}" not returned by Anthropic`);
            extraction[question.id] = { value: null, confidence: 0 };
        }
    }

    const processingTimeMs = Date.now() - startTime;

    // Overall confidence
    const scores = Object.values(extraction).map(f => f.confidence);
    const overallConfidence = scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : 0;

    console.log(
        `[Anthropic] Page ${pageNumber} extracted — ${Object.keys(extraction).length} fields, ` +
        `confidence=${overallConfidence}, ${processingTimeMs}ms`
    );

    return { extraction, processingTimeMs, overallConfidence, warnings };
}

/**
 * Check if Anthropic is configured.
 */
export function isAnthropicConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
}
