/**
 * Anthropic Claude Vision Extraction Service
 *
 * Ported from cantrac-omr-updated-2 into the Digital Diary API pipeline.
 *   - Sharp preprocessing: auto-rotate + force landscape + normalize + sharpen
 *   - Anthropic claude-sonnet-4-6 via direct HTTP
 *   - Schedule pages: chain-of-thought reasoning + 3000px high-res
 *   - Returns AIExtractionResult — identical format to the existing pipeline
 */

import sharp from "sharp";
import { AIExtractionResult, DiaryQuestion } from "./visionScan.types";

// ─── Config ────────────────────────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL   = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const MAX_TOKENS        = 4096; // increased for reasoning field on schedule pages

// Standard pages: 1600px / q=85  |  Schedule pages (tiny date bubbles): 3000px / q=95
const STD_MAX_DIM   = 1600;
const STD_QUALITY   = 85;
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
    reasoning?:  Record<string, string>;
    fields:      Record<string, AnthropicField>;
}

export interface AnthropicExtractionResult {
    extraction:        AIExtractionResult;
    processingTimeMs:  number;
    overallConfidence: number;
    warnings:          string[];
}

// ─── Image Preprocessing ──────────────────────────────────────────────────

/**
 * Preprocess phone photo for optimal vision API extraction.
 * Ported from cantrac-omr-updated-2/src/utils/image-preprocessor.js
 *
 * Steps:
 *   1. Auto-rotate via EXIF
 *   2. Force landscape — all CANTrac pages are landscape; portrait photos
 *      are rotated 90° clockwise so the form reads correctly
 *   3. Resize, normalize contrast, sharpen, compress
 */
async function preprocessForVision(
    imageBuffer: Buffer,
    maxDimension: number = STD_MAX_DIM,
    quality: number = STD_QUALITY
): Promise<Buffer> {
    // Step 1: Auto-rotate via EXIF
    let rotatedBuffer = await sharp(imageBuffer).rotate().toBuffer();
    let rotatedMeta   = await sharp(rotatedBuffer).metadata();

    // Step 2: Force landscape — rotate portrait images 90° clockwise
    if (rotatedMeta.height && rotatedMeta.width && rotatedMeta.height > rotatedMeta.width) {
        console.log("[Preprocessor] Portrait image detected — rotating to landscape");
        rotatedBuffer = await sharp(rotatedBuffer).rotate(90).toBuffer();
    }

    // Step 3: Resize, enhance, compress
    return sharp(rotatedBuffer)
        .resize(maxDimension, maxDimension, {
            fit: "inside",
            withoutEnlargement: true,
        })
        .normalize()
        .sharpen({ sigma: 1.0 })
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
9. For DATE ROWS (DD/MM/YY): each value label has a bubble circle to its LEFT. The filled dark bubble has the answer printed to its RIGHT. Exactly ONE bubble per row will be filled dark. DD values must be zero-padded: "01", "05", "14", "31".`;
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

/**
 * Specialized prompt for schedule pages.
 * Ported from cantrac-omr-updated-2/src/utils/prompt-builder.js buildSchedulePrompt()
 *
 * Key improvement: requires a "reasoning" field (chain-of-thought) so the model
 * describes what it sees in each row before committing to a value — greatly
 * improves accuracy on tiny date bubbles.
 */
function buildSchedulePrompt(pageNumber: number, pageTitle: string): string {
    return `This is CANTrac page ${pageNumber}: "${pageTitle}"

This is a SCHEDULE PAGE with appointment dates filled by a patient using dark blue/purple ink.

STEP-BY-STEP ANALYSIS REQUIRED:
For each section, you must carefully analyze each row of bubbles and describe what you see before giving the answer.

SECTION 1: "First Appointment" (first/top section on the page)
1. DD row: Bubbles and numbers are arranged as: ○01 ○02 ○03 ○04 ●05 ○06... The bubble is ALWAYS to the LEFT of its number. So if you see a filled bubble, read the number IMMEDIATELY TO THE RIGHT of that filled bubble. That is the selected day. Split across two lines: 01-16 on first line, 17-31 on second line. Report as two digits like "05", "14", "22".
2. MM row: Same pattern — bubble is to the LEFT of each month name: ○Jan ○Feb ○Mar ●Apr... Read the month name to the RIGHT of the filled bubble.
3. YY row: Three bubbles next to 2026, 2027, 2028. Which year has the dark filled bubble?
4. Status row: Four bubbles next to "Scheduled", "Completed", "Missed", "Cancelled". Which one is filled?

SECTION 2: "Second Attempt (If First Missed/Cancelled)" (second/bottom section)
Same structure as Section 1. This section may be completely empty (all bubbles unfilled) if no second attempt was needed.

FINAL QUESTION: "Next Appointment Required" at the very bottom — Yes or No.

HOW TO TELL FILLED vs EMPTY:
- FILLED: The circle is SOLID dark (blue, purple, or near-black). It is clearly different from all the others around it.
- EMPTY: The circle is just an outline — light pink or light gray. Most bubbles on the page look like this.
- In each row, there will be many empty bubbles and exactly ONE filled bubble (or zero if the row was not answered).

Respond with this JSON. The "reasoning" field is REQUIRED — describe what you see for each row before giving the value:
{
  "pageNumber": ${pageNumber},
  "pageType": "schedule",
  "title": "${pageTitle}",
  "reasoning": {
    "first_dd": "Scanning DD row 01-16... [describe which bubble looks dark]. Scanning 17-31... [describe]. The filled bubble is next to number XX.",
    "first_mm": "Scanning month row... [describe which month bubble is dark].",
    "first_yy": "Looking at 2026, 2027, 2028... [describe which is filled].",
    "first_status": "Looking at Scheduled, Completed, Missed, Cancelled... [describe which is filled].",
    "second_dd": "Scanning second attempt DD row... [describe or 'all empty'].",
    "second_mm": "Scanning second attempt month row... [describe or 'all empty'].",
    "second_yy": "Looking at second attempt year... [describe or 'all empty'].",
    "second_status": "Looking at second attempt status... [describe or 'all empty']."
  },
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
                            type:        "base64",
                            media_type:  "image/jpeg",
                            data:        base64Image,
                        },
                    },
                    {
                        type: "text",
                        text: userPrompt,
                    },
                ],
            },
            // Prefill assistant response with "{" — forces JSON output,
            // no preamble text regardless of model
            {
                role:    "assistant",
                content: "{",
            },
        ],
    };

    const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
            "Content-Type":      "application/json",
            "x-api-key":         apiKey,
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

    // Prepend the "{" we used as prefill
    const raw     = "{" + text;
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
    // Fix leading zeros in JSON number values (e.g. "value": 012 → "value": 12)
    const fixed   = cleaned.replace(/:\s*0+(\d+)/g, ": $1");

    try {
        return JSON.parse(fixed) as AnthropicRawResult;
    } catch {
        throw new Error(
            `Failed to parse Anthropic response as JSON: ${cleaned.substring(0, 500)}`
        );
    }
}

// ─── Main Export ──────────────────────────────────────────────────────────

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

    const startTime  = Date.now();
    const warnings:  string[] = [];
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

    // Log chain-of-thought reasoning (schedule pages only) then discard
    if (rawResult.reasoning) {
        console.log("[Anthropic] Model reasoning:", JSON.stringify(rawResult.reasoning, null, 2));
        delete rawResult.reasoning;
    }

    // Map Anthropic field format → AIExtractionResult format
    const extraction: AIExtractionResult = {};

    for (const question of questions) {
        if (question.type === "info") continue;

        const raw = rawResult.fields?.[question.id];

        if (raw) {
            const confidenceStr = raw.confidence || "medium";
            const confidence    = CONFIDENCE_MAP[confidenceStr] ?? 0.75;

            let value: string | null = raw.value ?? null;
            // Normalise yes/no to lowercase
            if (question.type === "yes_no" && value) {
                const lower = value.toLowerCase().trim();
                if (["yes", "हाँ", "y", "true"].includes(lower))        value = "yes";
                else if (["no", "नहीं", "n", "false"].includes(lower))  value = "no";
            }

            extraction[question.id] = { value, confidence };

            if (confidenceStr === "low") {
                warnings.push(`Low confidence on "${question.id}": ${question.text}`);
            }
        } else {
            warnings.push(`Field "${question.id}" not returned by Anthropic`);
            extraction[question.id] = { value: null, confidence: 0 };
        }
    }

    const processingTimeMs = Date.now() - startTime;

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

export function isAnthropicConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
}
