"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildExtractionPrompt = exports.VISION_SCAN_SYSTEM_PROMPT = exports.PAGE_DETECTION_PROMPT = void 0;
exports.PAGE_DETECTION_PROMPT = `Look at this image and determine:
1. Is this a photograph of a printed CANTrac medical diary page? The diary page will have a structured form layout with questions, yes/no bubbles, a page number, and typically a pink/magenta color scheme with the CANTrac branding or a breast cancer ribbon logo.
2. If yes, what is the page number printed on the document (usually at the top center)?

Return ONLY valid JSON (no markdown, no code fences, no explanation):
{ "isValidDiaryPage": true, "pageNumber": <number> }

If this is NOT a valid diary page (random photo, blank image, unrelated document, etc.):
{ "isValidDiaryPage": false, "reason": "<brief reason>" }`;
exports.VISION_SCAN_SYSTEM_PROMPT = `You are a highly accurate medical document scanner specialized in reading printed forms with filled bubbles, checkboxes, and handwritten text. You process photographs of paper documents taken in real-world conditions — on tables, beds, or other surfaces.

CORE PRINCIPLES:
- Focus EXCLUSIVELY on the document area. Ignore all background elements (fabric, wood, patterns, shadows, fingers, other objects).
- Be precise with bubble/checkbox detection. Bubbles may be filled with PEN or PENCIL — pencil marks are often lighter, grey, or faintly shaded. Treat any visible mark (dark ink, light pencil, grey shading, partial fill) as a FILLED bubble.
- Return structured JSON only. Never include explanations, markdown, or commentary.
- When uncertain, reflect that in your confidence score rather than guessing.`;
function buildExtractionPrompt(diaryPage) {
    const questionLines = diaryPage.questions
        .filter((q) => q.type !== "info")
        .map((q) => {
        let typeHint = "";
        switch (q.type) {
            case "yes_no":
                typeHint = 'type: yes_no — return "yes" or "no"';
                break;
            case "date":
                typeHint =
                    'type: date — return date string like "15/Jan/2026" or null';
                break;
            case "select":
                typeHint = `type: select — return one of: ${(q.options || []).join(", ")}`;
                break;
            case "text":
                typeHint =
                    "type: text — return the written/printed text";
                break;
        }
        return `  - "${q.id}": "${q.text}" (${typeHint})`;
    })
        .join("\n");
    return `You are analyzing a photograph of a medical diary page (CANTrac Breast Cancer Diary).
This is Page ${diaryPage.pageNumber}: "${diaryPage.title}".

IMAGE CONTEXT:
- The image is a photograph of a printed page placed on a surface (table, bed, fabric, etc.).
- IGNORE everything outside the white document area — background textures, patterns, shadows, and any non-document elements.
- Focus ONLY on the printed form content within the document boundaries.

Your task: Look at the image and fill in the values for these EXACT fields:
${questionLines}

CRITICAL BUBBLE DETECTION RULES:
- A FILLED bubble has ANY visible mark inside it — pen ink, pencil shading, grey/silver fill, partial shading, or any marking that makes it visually different from a completely empty bubble.
- An EMPTY bubble is a clean, hollow circle with nothing inside — just the printed outline.
- Do NOT require dark or bold marks. Even light pencil marks, faint shading, or subtle grey fills count as FILLED.
- SPATIAL LAYOUT: For Yes/No rows, "Yes" with its bubble is ALWAYS on the LEFT. "No" with its bubble is ALWAYS on the RIGHT.
- For each row, carefully compare BOTH bubbles side by side. The one with ANY mark/fill/shading inside it (even faint) is the selected answer.
- IGNORE the left checkbox column (those are for doctors only).
- For date fields (DD/MM/YY bubbles), combine into a single date string like "03/Mar/2026".
- For status fields, return only the selected option from the allowed values.
- For yes_no fields, return lowercase "yes" or "no".
- If a field has no bubble filled, return null for value and 1.0 for confidence (you're confident it's empty).
- For each field, include a confidence score (0.0 to 1.0):
  - 0.9-1.0: bubble is clearly filled or clearly empty
  - 0.7-0.9: fairly sure but lighting/angle makes it slightly ambiguous
  - Below 0.7: genuinely uncertain

Return ONLY valid JSON (no markdown, no code fences, no explanation) using the EXACT field IDs above as keys:
{
  "<field_id>": { "value": "<detected value or null>", "confidence": <0.0-1.0> },
  ...
}`;
}
exports.buildExtractionPrompt = buildExtractionPrompt;
