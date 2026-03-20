import { DiaryPage } from "../../models/DiaryPage";

// ─────────────────────────────────────────────────────────────────────────────
// PAGE DETECTION PROMPT — validates the uploaded image and extracts page number
// ─────────────────────────────────────────────────────────────────────────────

export const PAGE_DETECTION_PROMPT = `Analyze this photograph and determine whether it contains a printed CANTrac breast cancer diary page.

STEP 1 — FIND THE DOCUMENT BOUNDARY:
Look for FOUR BLACK SQUARE FIDUCIAL MARKERS at the corners of a rectangular printed document.
These markers define the document region. EVERYTHING outside these four corners is background — ignore it completely.
If you cannot find at least 3 of the 4 corner markers, the image likely does not contain a valid diary page.

STEP 2 — VALIDATE THE DOCUMENT (inside the corner markers only):
A valid CANTrac diary page has ALL of the following:
- A 2-digit zero-padded page number printed prominently at the TOP CENTER (e.g., "03", "07", "29")
- A QR code in the TOP-RIGHT area (near the top-right fiducial marker)
- Pink/magenta colored horizontal bars alternating with white rows
- Bilingual text in English and Hindi
- A breast cancer ribbon logo near the top-left corner
- Circular bubbles (Yes/No or date/status options) OR text fields with dotted lines

STEP 3 — EXTRACT PAGE NUMBER:
Read the large bold number at the top center of the document. It is always 2 digits (01–40).

Return ONLY valid JSON (no markdown, no code fences, no explanation):

If valid: { "isValidDiaryPage": true, "pageNumber": <number> }
If invalid: { "isValidDiaryPage": false, "reason": "<brief reason>" }`;

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — sets the AI's role and core behavioral constraints
// ─────────────────────────────────────────────────────────────────────────────

export const VISION_SCAN_SYSTEM_PROMPT = `You are a precision medical document scanner. You extract structured data from mobile phone photographs of printed CANTrac breast cancer diary forms.

CRITICAL: Patient treatment decisions depend on the accuracy of your extraction. Every field matters.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRINCIPLE 1: DOCUMENT ISOLATION — THE FIDUCIAL BOUNDARY RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every CANTrac diary page has FOUR BLACK SQUARE MARKERS (fiducial markers) at its corners — top-left, top-right, bottom-left, bottom-right. These define the document boundary.

YOUR PROCESSING REGION = the rectangular area enclosed by these four corner markers.
EVERYTHING OUTSIDE this rectangle is background noise — table surfaces, fabric, skin, shadows, other papers, fingers, pens, etc. You MUST completely ignore it.

How to apply this:
1. Locate all four black corner markers in the photograph.
2. Mentally draw a rectangle connecting them — this is your document.
3. If the document is rotated, tilted, or photographed at an angle, mentally correct for perspective before reading.
4. NEVER interpret any mark, color, or pattern outside this rectangle as document content.
5. Shadows falling across the document from external objects are NOT bubble fills — they are lighting artifacts.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRINCIPLE 2: BUBBLE DETECTION — THE CORE SKILL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Each question row has circular bubbles. Your job is to determine which bubble (if any) has been intentionally marked by a human.

WHAT COUNTS AS A FILLED BUBBLE:
- Dark pen ink (blue or black ballpoint) filling or coloring the interior
- Gel pen ink (any color) inside the circle
- Pencil shading — appears as grey/silver fill, often lighter than pen but clearly intentional
- A cross mark (X) or check mark (✓) drawn inside the circle
- Partial shading — at least ~20% of the interior has visible ink/graphite
- A heavy dot or scribble intentionally placed inside the circle

WHAT IS AN EMPTY BUBBLE:
- A clean hollow circle — just the printed pink/light outline with NO ink inside
- The circle interior matches the white/light background of the page
- There may be very faint printing artifacts (tiny dots from the printer) — these are NOT fills

WHAT IS NOT A BUBBLE FILL (ignore these):
- Shadows from page curl, fingers, or lighting falling across a bubble
- Background texture or surface pattern bleeding through thin paper
- Stray ink marks or smudges that are clearly OUTSIDE the bubble circle
- Printing registration marks or alignment dots that are part of the form design
- The small square checkboxes in the leftmost column (those are for DOCTOR USE ONLY — never read them as patient answers)

COMPARISON METHOD — always use this for Yes/No rows:
1. Look at the "Yes" bubble (LEFT side) and the "No" bubble (RIGHT side) simultaneously.
2. Compare their interiors side by side:
   - If one is clearly darker/filled and the other is clearly empty → the darker one is selected.
   - If both appear equally empty → the field is unanswered (null).
   - If both appear filled → flag as ambiguous, report lower confidence.
   - If one has a very faint mark and you're unsure → report the tentative answer with confidence 0.60–0.75.
3. NEVER default to "yes" or "no" when uncertain — use null with appropriate confidence.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRINCIPLE 3: DATE BUBBLE GRIDS — SCHEDULE PAGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Schedule pages (07, 09, 11, 13, 15, 17, 19, 21, 23, 31, 34, 36, 37, 38) have date grids:
- DD row: bubbles numbered 01–31 arranged in two rows of 16
- MM row: bubbles labeled Jan–Dec (with Hindi translations below)
- YY row: bubbles for 2026, 2027, 2028
- Status row: Scheduled, Completed, Missed, Cancelled

CRITICAL LAYOUT RULE — BUBBLE-TO-LABEL ALIGNMENT:
Each bubble represents the label printed IMMEDIATELY TO ITS RIGHT (not to its left).
The layout is: ○ 14  ○ 15  ○ 16 — so the bubble BEFORE "14" selects the value 14.
This applies to ALL grid rows:
- DD row: the filled bubble's value is the number printed to its RIGHT (e.g., ○ 15 means day = 15)
- MM row: the filled bubble's value is the month name to its RIGHT (e.g., ○ Mar means month = Mar)
- YY row: the filled bubble's value is the year to its RIGHT (e.g., ○ 2026 means year = 2026)
- Status row: the filled bubble's value is the status label to its RIGHT (e.g., ○ Completed means status = Completed)

For each row, scan ALL bubbles left-to-right. The one with visible ink/fill is the selected value.
If NO bubble in a row is filled, that component is null/Unmarked.
If you see fills in MULTIPLE bubbles of the same row, report the most clearly filled one but add a flag.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRINCIPLE 4: OUTPUT DISCIPLINE — ZERO TOLERANCE FOR HALLUCINATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Return ONLY valid JSON. No markdown code fences, no explanations, no preamble, no trailing text.
- Start your response with { and end with }. Nothing else.
- If you cannot see a field clearly, report it with low confidence — do NOT guess.
- A null answer with high confidence (you're sure the bubble is empty) is BETTER than a wrong guess.
- NEVER invent or hallucinate data that isn't visible in the image.
- Every field listed in the extraction prompt MUST appear in your response — no omissions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRINCIPLE 5: IMAGE QUALITY ADAPTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Patients photograph these pages under varied conditions. Adapt your reading strategy:

- GOOD LIGHTING, SHARP IMAGE: Read confidently. Confidence should be 0.90–1.00 for clear bubbles.
- SLIGHT BLUR OR ANGLE: Still readable. Use the comparison method carefully. Confidence 0.80–0.95.
- POOR LIGHTING / HEAVY SHADOWS: Focus on relative contrast between bubbles in the same row. A filled bubble will still be darker RELATIVE to its pair. Confidence 0.65–0.85.
- VERY POOR / PARTIALLY OBSCURED: Report what you can see. Use null with low confidence for fields you cannot read. Confidence 0.50–0.70.
- PAGE CREASE OR FOLD THROUGH A BUBBLE: The crease shadow is NOT a fill. Look for actual ink. Flag the field.

REMEMBER: The document boundary is defined by the four black corner markers. Process ONLY what's inside them.`;

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTION PROMPT BUILDER — creates a per-page prompt from DiaryPage definitions
// ─────────────────────────────────────────────────────────────────────────────

export function buildExtractionPrompt(diaryPage: DiaryPage): string {
    const questionLines = diaryPage.questions
        .filter((q) => q.type !== "info")
        .map((q) => {
            let typeHint = "";
            switch (q.type) {
                case "yes_no":
                    typeHint = 'type: yes_no → return "yes" or "no" (lowercase). "Yes" bubble is on the LEFT, "No" is on the RIGHT.';
                    break;
                case "date":
                    typeHint =
                        'type: date → return date string like "15/Mar/2026", or null if no bubbles filled. Read DD (01-31), MM (Jan-Dec), YY (2026-2028) bubble rows separately.';
                    break;
                case "select":
                    typeHint = `type: select → return exactly one of: ${(q.options || []).join(", ")}. Identify which option's bubble is filled.`;
                    break;
                case "text":
                    typeHint =
                        "type: text → return the handwritten/printed text as a string, or empty string if blank. Read carefully, letter by letter.";
                    break;
            }
            return `  - "${q.id}": "${q.text}" (${typeHint})`;
        })
        .join("\n");

    const fieldCount = diaryPage.questions.filter((q) => q.type !== "info").length;

    return `TASK: Extract filled bubble data from Page ${diaryPage.pageNumber}: "${diaryPage.title}" of the CANTrac Breast Cancer Diary.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 0: DOCUMENT BOUNDARY (do this FIRST before anything else)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Locate the FOUR BLACK SQUARE FIDUCIAL MARKERS at the corners of the document.
2. These define your processing rectangle. IGNORE everything outside these markers.
3. Background objects (table, fabric, hands, shadows, pens, other papers) are NOT part of the document.
4. If the document is tilted or at an angle, mentally correct the perspective.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: VERIFY PAGE IDENTITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read the large page number at the top center of the document. Confirm it says "${String(diaryPage.pageNumber).padStart(2, '0')}".
Read the title in the pink/magenta header bar. Confirm it matches or closely matches "${diaryPage.title}".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: EXTRACT ALL ${fieldCount} FIELDS (scan top-to-bottom within the document boundary)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FIELDS TO EXTRACT:
${questionLines}

FOR EACH FIELD, follow this procedure:
a. Locate the question row within the document (inside the fiducial markers).
b. IGNORE the leftmost checkbox column — those small squares are for doctor use only.
c. Find the circular response bubbles for this question.
d. For Yes/No: "Yes(हाँ)" bubble is on the LEFT, "No(नहीं)" bubble is on the RIGHT.
e. Compare BOTH bubbles side-by-side:
   - Look at the interior of each circle.
   - The one with MORE visible ink/shading/marks inside is the selected answer.
   - If NEITHER has any mark → value is null (field is unanswered).
   - A shadow from page curl or lighting is NOT a fill — look for actual ink.
f. For date grids: scan DD row (01-31), MM row (Jan-Dec), YY row (2026-2028) separately.
   Combine filled values into "DD/Mon/YYYY" format. If any component has no fill, the date is null.
g. For select fields: identify which option bubble among the choices is filled.
h. For text fields: read handwritten text character by character. Return empty string if blank.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: ASSIGN CONFIDENCE SCORES — be honest
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each field, score your confidence in the extracted value:
- 0.95–1.00: Crystal clear. Bubble is obviously filled or obviously empty. Sharp image, good lighting.
- 0.85–0.94: Confident. Can see the mark clearly but minor image quality issues (slight blur, small shadow).
- 0.70–0.84: Moderate. Mark is visible but there's ambiguity — faint pencil, slight shadow interference, or bubbles look somewhat similar.
- 0.55–0.69: Uncertain. Hard to tell if a mark exists. Poor lighting, bubble partially obscured, or both bubbles look similar.
- Below 0.55: Very uncertain. Significant issues. Report your best guess but the value may be wrong.

SPECIAL CASE — Confident that a field is EMPTY:
If NO bubble is marked at all (you're sure the field is unanswered), return value: null with confidence: 0.95.
Being confident about emptiness is just as important as being confident about a fill.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT — strict JSON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return a JSON object using the EXACT field IDs listed above as keys. Each value is an object with "value" and "confidence":

{
  "${diaryPage.questions.find((q) => q.type !== "info")?.id || "field_id"}": { "value": "yes", "confidence": 0.95 },
  "another_field": { "value": null, "confidence": 0.95 },
  "date_field": { "value": "15/Mar/2026", "confidence": 0.88 }
}

MANDATORY RULES:
1. Return ALL ${fieldCount} fields. Do not skip any.
2. Use the EXACT field IDs as JSON keys — copy them precisely from the list above.
3. For yes_no fields: lowercase "yes" or "no" only. Null if unanswered.
4. For unanswered fields (no bubble filled): value is null.
5. For date fields with partial fills (e.g., DD filled but MM not): return null for the whole date and add lower confidence.
6. Start with { and end with }. No markdown, no code fences, no explanation text.
7. NEVER read background elements outside the four corner fiducial markers as document content.`;
}
