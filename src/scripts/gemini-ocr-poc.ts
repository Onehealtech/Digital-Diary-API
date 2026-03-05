/**
 * POC: Diary Page Bubble Detection using Gemini Flash Vision via OpenRouter
 *
 * Tests Gemini's ability to extract filled bubble answers from
 * CANTrac diary page photos. Uses OpenRouter for model routing.
 *
 * Usage:
 *   # Single image:
 *   npx ts-node src/scripts/gemini-ocr-poc.ts test-images/page29.jpg
 *
 *   # Folder of images:
 *   npx ts-node src/scripts/gemini-ocr-poc.ts test-images/
 *
 * API key is read from .env (OPENROUTER_API_KEY)
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../../.env") });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash"; // ~$0.0007/image via OpenRouter
const MAX_IMAGE_DIMENSION = 1024;

const EXTRACTION_PROMPT = `You are analyzing a photograph of a medical diary page (CANTrac Breast Cancer Diary).

Your task:
1. Identify the page number (printed at the top).
2. Identify the page title/heading.
3. Extract ONLY the SELECTED values — do NOT list every option, only what the patient filled in.

CRITICAL BUBBLE DETECTION RULES:
- A FILLED bubble is a SOLID DARK circle (blue/black ink, completely filled). It is distinctly darker and heavier than empty bubbles.
- An EMPTY bubble is a HOLLOW circle with just a thin outline — light/white inside.
- SPATIAL LAYOUT: For Yes/No rows, "Yes" with its bubble is ALWAYS on the LEFT. "No" with its bubble is ALWAYS on the RIGHT. Carefully check which SIDE has the solid dark bubble.
- For each row, visually compare BOTH bubbles. One will be clearly darker/filled. Report the one that is filled (left=Yes, right=No).
- IGNORE the left checkbox column (those are for doctors only).
- For date fields (DD/MM/YY bubbles), combine into a single date string like "03/Mar/2026".
- For status fields (Scheduled/Completed/Missed/Cancelled), return only the selected one.
- For Yes/No fields, return "Yes" or "No".
- If a field has no bubble filled, return null for value and 1.0 for confidence (you're confident it's empty).
- If a page has multiple sections (e.g. "First Appointment", "Second Attempt"), group them.
- For each field, include a confidence score (0.0 to 1.0) for how certain you are about the detected value.
  - 0.9-1.0: bubble is clearly filled or clearly empty
  - 0.7-0.9: fairly sure but lighting/angle makes it slightly ambiguous
  - Below 0.7: genuinely uncertain, could be either option

Return ONLY valid JSON (no markdown, no code fences, no explanation):
{
  "page_number": <int>,
  "page_title": "<string>",
  "sections": [
    {
      "section_title": "<section name or 'Main' if no sections>",
      "fields": [
        { "field": "<field label in English>", "value": "<selected value or null>", "confidence": <0.0-1.0> }
      ]
    }
  ],
  "overall_confidence": "high|medium|low",
  "notes": "<any issues or null>"
}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface OpenRouterResponse {
  choices?: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: { message: string; code: number };
}

interface ExtractionResult {
  page_number: number;
  page_title: string;
  sections: Array<{
    section_title: string;
    fields: Array<{ field: string; value: string | null; confidence: number }>;
  }>;
  overall_confidence: string;
  notes: string | null;
}

interface ImageResult {
  file: string;
  fileName: string;
  originalSizeKB: number;
  processingTimeMs: number;
  tokenUsage: {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
  };
  extraction: ExtractionResult | { error: string; rawResponse?: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;

  if (!key) {
    console.error("=".repeat(60));
    console.error("OPENROUTER_API_KEY NOT FOUND in .env\n");
    console.error("Add to .env: OPENROUTER_API_KEY=sk-or-v1-...");
    console.error("\nGet a key at: https://openrouter.ai/keys");
    console.error("=".repeat(60));
    process.exit(1);
  }
  return key;
}

function imageToBase64(filePath: string): { base64: string; mimeType: string } {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
  };
  const mimeType = mimeMap[ext] || "image/jpeg";
  const buffer = fs.readFileSync(filePath);
  return { base64: buffer.toString("base64"), mimeType };
}

function findImages(targetPath: string): string[] {
  const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp"]);
  const stat = fs.statSync(targetPath);

  if (stat.isFile()) {
    const ext = path.extname(targetPath).toLowerCase();
    return imageExtensions.has(ext) ? [targetPath] : [];
  }

  if (stat.isDirectory()) {
    return fs
      .readdirSync(targetPath)
      .filter((f) => imageExtensions.has(path.extname(f).toLowerCase()))
      .map((f) => path.join(targetPath, f))
      .sort();
  }

  return [];
}

// ---------------------------------------------------------------------------
// OpenRouter API Call (OpenAI-compatible format)
// ---------------------------------------------------------------------------
async function callOpenRouter(
  apiKey: string,
  base64Image: string,
  mimeType: string,
): Promise<OpenRouterResponse> {
  const body = {
    model: MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACTION_PROMPT },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 2048,
  };

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://onehealtech.com",
      "X-Title": "CANTrac Diary OCR POC",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<OpenRouterResponse>;
}

// ---------------------------------------------------------------------------
// Process Single Image
// ---------------------------------------------------------------------------
async function processImage(
  apiKey: string,
  imagePath: string,
): Promise<ImageResult> {
  const startTime = Date.now();
  const fileStat = fs.statSync(imagePath);
  const originalSizeKB = Math.round(fileStat.size / 1024);

  const { base64, mimeType } = imageToBase64(imagePath);

  try {
    const response = await callOpenRouter(apiKey, base64, mimeType);

    if (response.error) {
      return {
        file: imagePath,
        fileName: path.basename(imagePath),
        originalSizeKB,
        processingTimeMs: Date.now() - startTime,
        tokenUsage: { promptTokens: 0, responseTokens: 0, totalTokens: 0 },
        extraction: { error: response.error.message },
      };
    }

    const rawText = response.choices?.[0]?.message?.content || "";
    const usage = response.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    // Clean up response — remove markdown code fences if present
    let cleanText = rawText.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "");
    }

    let extraction: ExtractionResult | { error: string; rawResponse?: string };
    try {
      extraction = JSON.parse(cleanText) as ExtractionResult;
    } catch {
      extraction = {
        error: "JSON parse failed",
        rawResponse: cleanText.slice(0, 500),
      };
    }

    return {
      file: imagePath,
      fileName: path.basename(imagePath),
      originalSizeKB,
      processingTimeMs: Date.now() - startTime,
      tokenUsage: {
        promptTokens: usage.prompt_tokens,
        responseTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
      extraction,
    };
  } catch (err: any) {
    return {
      file: imagePath,
      fileName: path.basename(imagePath),
      originalSizeKB,
      processingTimeMs: Date.now() - startTime,
      tokenUsage: { promptTokens: 0, responseTokens: 0, totalTokens: 0 },
      extraction: { error: err.message },
    };
  }
}

// ---------------------------------------------------------------------------
// Pretty Print
// ---------------------------------------------------------------------------
function printResult(result: ImageResult): void {
  const ext = result.extraction;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`FILE: ${result.fileName}`);
  console.log(
    `Size: ${result.originalSizeKB}KB | Time: ${result.processingTimeMs}ms | Tokens: ${result.tokenUsage.totalTokens}`,
  );
  console.log("-".repeat(60));

  if ("error" in ext) {
    console.log(`  ERROR: ${ext.error}`);
    if (ext.rawResponse) console.log(`  Raw: ${ext.rawResponse.slice(0, 200)}`);
    return;
  }

  console.log(
    `  Page: ${ext.page_number} | Title: ${ext.page_title} | Overall: ${ext.overall_confidence}`,
  );

  for (const section of ext.sections || []) {
    console.log(`  [${section.section_title}]`);
    for (const f of section.fields) {
      const val = f.value !== null ? f.value : "(empty)";
      const conf = f.confidence !== undefined ? ` (${f.confidence})` : "";
      const flag = f.confidence !== undefined && f.confidence < 0.8 ? " ⚠️" : "";
      console.log(`    -> ${f.field}: [${val}]${conf}${flag}`);
    }
  }

  if (ext.notes) console.log(`  Notes: ${ext.notes}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const targetPath = process.argv[2];

  if (!targetPath) {
    console.log(
      "Usage: npx ts-node src/scripts/gemini-ocr-poc.ts <image_or_folder>",
    );
    console.log("\nExamples:");
    console.log(
      "  npx ts-node src/scripts/gemini-ocr-poc.ts test-images/page29.jpg",
    );
    console.log("  npx ts-node src/scripts/gemini-ocr-poc.ts test-images/");
    process.exit(1);
  }

  const apiKey = getApiKey();
  const images = findImages(targetPath);

  if (images.length === 0) {
    console.error(`No images found at: ${targetPath}`);
    process.exit(1);
  }

  // Create per-image results directory
  const resultsDir = path.join(__dirname, "../../gemini-ocr-results");
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  console.log(`Found ${images.length} image(s) to process`);
  console.log(`Model: ${MODEL} (via OpenRouter)`);
  console.log(`Per-image results: ${resultsDir}/`);

  const results: ImageResult[] = [];

  for (let i = 0; i < images.length; i++) {
    const imgPath = images[i];
    process.stdout.write(
      `\nProcessing [${i + 1}/${images.length}]: ${path.basename(imgPath)}...`,
    );

    const result = await processImage(apiKey, imgPath);
    results.push(result);

    // Save per-image result immediately (crash-safe)
    const baseName = path.basename(imgPath, path.extname(imgPath));
    const perImageFile = path.join(resultsDir, `${baseName}.json`);
    fs.writeFileSync(perImageFile, JSON.stringify(result, null, 2));

    process.stdout.write(` done (${result.processingTimeMs}ms)\n`);
    printResult(result);
    console.log(`  Saved: ${perImageFile}`);

    // Small delay to avoid rate limits on free tier
    if (i < images.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const totalInput = results.reduce((s, r) => s + r.tokenUsage.promptTokens, 0);
  const totalOutput = results.reduce(
    (s, r) => s + r.tokenUsage.responseTokens,
    0,
  );
  const inputCost = (totalInput / 1_000_000) * 0.1;
  const outputCost = (totalOutput / 1_000_000) * 0.4;
  const totalCost = inputCost + outputCost;
  const successCount = results.filter((r) => !("error" in r.extraction)).length;

  console.log(`\n${"=".repeat(60)}`);
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total images:     ${results.length}`);
  console.log(`Successful:       ${successCount}`);
  console.log(`Failed:           ${results.length - successCount}`);
  console.log(`Total tokens:     ${totalInput} input + ${totalOutput} output`);
  console.log(`Estimated cost:   $${totalCost.toFixed(6)}`);
  console.log(
    `Cost per image:   $${(totalCost / Math.max(results.length, 1)).toFixed(6)}`,
  );
  console.log(
    `Projected 40K:    $${((totalCost / Math.max(results.length, 1)) * 40000).toFixed(2)}`,
  );

  // Save results
  const outputFile = path.join(__dirname, "../../gemini-ocr-results.json");
  const outputData = {
    model: MODEL,
    timestamp: new Date().toISOString(),
    results,
    costEstimate: {
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      estimatedCostUsd: +totalCost.toFixed(6),
      costPerImageUsd: +(totalCost / Math.max(results.length, 1)).toFixed(6),
      projected40kImagesUsd: +(
        (totalCost / Math.max(results.length, 1)) *
        40000
      ).toFixed(2),
    },
    summary: {
      total: results.length,
      successful: successCount,
      failed: results.length - successCount,
    },
  };

  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
  console.log(`\nResults saved to: ${outputFile}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
