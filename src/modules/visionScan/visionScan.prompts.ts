// // import { DiaryPage } from "../../models/DiaryPage";

// // export const PAGE_DETECTION_PROMPT = `Look at this image and determine:
// // 1. Is this a photograph of a printed CANTrac medical diary page? The diary page will have a structured form layout with questions, yes/no bubbles, a page number, and typically a pink/magenta color scheme with the CANTrac branding or a breast cancer ribbon logo.
// // 2. If yes, what is the page number printed on the document (usually at the top center)?

// // Return ONLY valid JSON (no markdown, no code fences, no explanation):
// // { "isValidDiaryPage": true, "pageNumber": <number> }

// // If this is NOT a valid diary page (random photo, blank image, unrelated document, etc.):
// // { "isValidDiaryPage": false, "reason": "<brief reason>" }`;

// // export const VISION_SCAN_SYSTEM_PROMPT = `You are a highly accurate medical document scanner specialized in reading printed forms with filled bubbles, checkboxes, and handwritten text. You process photographs of paper documents taken in real-world conditions — on tables, beds, or other surfaces.

// // CORE PRINCIPLES:
// // - Focus EXCLUSIVELY on the document area. Ignore all background elements (fabric, wood, patterns, shadows, fingers, other objects).
// // - Be precise with bubble/checkbox detection. Bubbles may be filled with PEN or PENCIL — pencil marks are often lighter, grey, or faintly shaded. Treat any visible mark (dark ink, light pencil, grey shading, partial fill) as a FILLED bubble.
// // - Return structured JSON only. Never include explanations, markdown, or commentary.
// // - When uncertain, reflect that in your confidence score rather than guessing.`;

// // export function buildExtractionPrompt(diaryPage: DiaryPage): string {
// //     const questionLines = diaryPage.questions
// //         .filter((q) => q.type !== "info")
// //         .map((q) => {
// //             let typeHint = "";
// //             switch (q.type) {
// //                 case "yes_no":
// //                     typeHint = 'type: yes_no — return "yes" or "no"';
// //                     break;
// //                 case "date":
// //                     typeHint =
// //                         'type: date — return date string like "15/Jan/2026" or null';
// //                     break;
// //                 case "select":
// //                     typeHint = `type: select — return one of: ${(q.options || []).join(", ")}`;
// //                     break;
// //                 case "text":
// //                     typeHint =
// //                         "type: text — return the written/printed text";
// //                     break;
// //             }
// //             return `  - "${q.id}": "${q.text}" (${typeHint})`;
// //         })
// //         .join("\n");

// //     return `You are analyzing a photograph of a medical diary page (CANTrac Breast Cancer Diary).
// // This is Page ${diaryPage.pageNumber}: "${diaryPage.title}".

// // IMAGE CONTEXT:
// // - The image is a photograph of a printed page placed on a surface (table, bed, fabric, etc.).
// // - IGNORE everything outside the white document area — background textures, patterns, shadows, and any non-document elements.
// // - Focus ONLY on the printed form content within the document boundaries.

// // Your task: Look at the image and fill in the values for these EXACT fields:
// // ${questionLines}

// // CRITICAL BUBBLE DETECTION RULES:
// // - A FILLED bubble has ANY visible mark inside it — pen ink, pencil shading, grey/silver fill, partial shading, or any marking that makes it visually different from a completely empty bubble.
// // - An EMPTY bubble is a clean, hollow circle with nothing inside — just the printed outline.
// // - Do NOT require dark or bold marks. Even light pencil marks, faint shading, or subtle grey fills count as FILLED.
// // - SPATIAL LAYOUT: For Yes/No rows, "Yes" with its bubble is ALWAYS on the LEFT. "No" with its bubble is ALWAYS on the RIGHT.
// // - For each row, carefully compare BOTH bubbles side by side. The one with ANY mark/fill/shading inside it (even faint) is the selected answer.
// // - IGNORE the left checkbox column (those are for doctors only).
// // - For date fields (DD/MM/YY bubbles), combine into a single date string like "03/Mar/2026".
// // - For status fields, return only the selected option from the allowed values.
// // - For yes_no fields, return lowercase "yes" or "no".
// // - If a field has no bubble filled, return null for value and 1.0 for confidence (you're confident it's empty).
// // - For each field, include a confidence score (0.0 to 1.0):
// //   - 0.9-1.0: bubble is clearly filled or clearly empty
// //   - 0.7-0.9: fairly sure but lighting/angle makes it slightly ambiguous
// //   - Below 0.7: genuinely uncertain

// // Return ONLY valid JSON (no markdown, no code fences, no explanation) using the EXACT field IDs above as keys:
// // {
// //   "<field_id>": { "value": "<detected value or null>", "confidence": <0.0-1.0> },
// //   ...
// // }`;
// // }


// import { DiaryPage } from "../../models/DiaryPage";

// // ═══════════════════════════════════════════════════════════════════════════════
// // CANTrac PRODUCTION PROMPT SYSTEM — v4 FINAL
// // ═══════════════════════════════════════════════════════════════════════════════
// // Consolidated single file. No duplicate declarations.
// // All fields use uniform { "value": ..., "confidence": ... } output format.
// // Date handling covers every response shape Gemini might return.
// // ═══════════════════════════════════════════════════════════════════════════════


// // ─────────────────────── TYPES ──────────────────────────

// interface DiaryQuestion {
//   id: string;
//   text: string;
//   type: string;
//   options?: string[];
// }

// interface BackendScanResult {
//   answer: string | number | boolean | null;
//   category: string;
//   confidence: number;
//   questionText: string;
// }

// interface ValidationResult {
//   valid: boolean;
//   allNull: boolean;
//   missingFields: string[];
//   badDates: string[];
//   lowConfidenceFields: string[];
//   errors: string[];
// }


// // ─────────────────────── CONSTANTS ──────────────────────

// const VALID_MONTHS = new Set([
//   "Jan", "Feb", "Mar", "Apr", "May", "Jun",
//   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
// ]);

// const VALID_YEARS = new Set(["2026", "2027", "2028"]);

// const MONTH_MAP: Record<string, string> = {
//   // English lowercase
//   jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", may: "May", jun: "Jun",
//   jul: "Jul", aug: "Aug", sep: "Sep", oct: "Oct", nov: "Nov", dec: "Dec",
//   // English full
//   january: "Jan", february: "Feb", march: "Mar", april: "Apr",
//   june: "Jun", july: "Jul", august: "Aug", september: "Sep",
//   october: "Oct", november: "Nov", december: "Dec",
//   // Hindi abbreviated
//   "जन": "Jan", "फर": "Feb", "मार्च": "Mar", "अप्रैल": "Apr",
//   "मई": "May", "जून": "Jun", "जुला": "Jul", "अग": "Aug",
//   "सित": "Sep", "अक्तू": "Oct", "नव": "Nov", "दिस": "Dec",
//   // Hindi full (only keys not already covered above)
//   "जनवरी": "Jan", "फरवरी": "Feb", "जुलाई": "Jul", "अगस्त": "Aug",
//   "सितंबर": "Sep", "अक्टूबर": "Oct", "नवंबर": "Nov", "दिसंबर": "Dec",
// };

// const HINDI_STATUS_MAP: Record<string, string> = {
//   "सारणी": "Scheduled", "संपन्न": "Completed",
//   "छूक गया": "Missed", "रद्": "Cancelled",
// };


// // ═══════════════════════════════════════════════════════════════════════════════
// // 1. SYSTEM PROMPT
// // ═══════════════════════════════════════════════════════════════════════════════

// export const VISION_SCAN_SYSTEM_PROMPT = `You are a medical form scanner extracting filled bubble data from photographs of CANTrac breast cancer diary pages.

// FORM LAYOUT:
// - Page bounded by 4 BLACK SQUARE corner markers. Only read INSIDE these markers.
// - Ignore everything outside: table, fabric, hands, shadows, other papers.

// BUBBLE APPEARANCE:
// - FILLED bubbles can look different depending on the writing instrument:
//   * BALLPOINT PEN: solid DARK BLUE/BLACK circle. Very high contrast against the white page.
//   * GEL PEN: solid colored circle (blue, black, or other ink color). High contrast.
//   * PENCIL/GRAPHITE: GREY or SILVER shaded circle. LOWER contrast than pen — appears as a soft grey fill rather than stark black. The interior looks CLOUDY, SMOKY, or HAZY compared to empty bubbles. May appear faint but is still clearly different from an empty bubble.
// - EMPTY = thin PINK outline with WHITE/CLEAN interior. No ink or graphite inside. The interior is crisp and matches the page background.

// KEY DETECTION RULE:
// Compare bubble interiors RELATIVE TO EACH OTHER within the same row. The filled bubble — whether pen or pencil — will always have MORE visual material (darker, greyer, hazier) inside it than the empty bubbles in that same row. Even a faint pencil mark makes the bubble interior noticeably different from the clean, crisp empty bubbles nearby.

// Do NOT require dark black ink to count as filled. ANY intentional mark — dark pen, light pencil, grey graphite — counts as a fill if the bubble interior looks different from empty bubbles in the same row.

// RULES:
// - Submitted forms almost always have answers filled in. All-null is almost always wrong.
// - Return ONLY valid JSON. No markdown. No explanation. No code fences. Start with { end with }.`;


// // ═══════════════════════════════════════════════════════════════════════════════
// // 2. PAGE DETECTION
// // ═══════════════════════════════════════════════════════════════════════════════

// export const PAGE_DETECTION_PROMPT = `What is the 2-digit page number at the top center of this CANTrac diary page?
// Return JSON only: {"isValidDiaryPage": true, "pageNumber": <number>} or {"isValidDiaryPage": false, "reason": "<brief>"}`;


// // ═══════════════════════════════════════════════════════════════════════════════
// // 3. EXTRACTION PROMPT — MAIN ENTRY POINT
// // ═══════════════════════════════════════════════════════════════════════════════

// export function buildExtractionPrompt(diaryPage: DiaryPage): string {
//   const types = new Set(
//     diaryPage.questions.filter(q => q.type !== "info").map(q => q.type)
//   );
//   const isSchedule = types.has("date") || types.has("select");
//   return isSchedule
//     ? buildSchedulePrompt(diaryPage)
//     : buildYesNoPrompt(diaryPage);
// }


// // ─────────────────────── YES/NO PAGES ──────────────────────

// function buildYesNoPrompt(diaryPage: DiaryPage): string {
//   const questions = diaryPage.questions.filter(q => q.type !== "info");
//   const pageNum = String(diaryPage.pageNumber).padStart(2, "0");

//   const fieldList = questions.map(q => {
//     if (q.type === "yes_no")
//       return `  "${q.id}": "${q.text}" → LEFT bubble = Yes, RIGHT bubble = No`;
//     if (q.type === "text")
//       return `  "${q.id}": "${q.text}" → read handwritten text, or "" if blank`;
//     return `  "${q.id}": "${q.text}" → string | null`;
//   }).join("\n");

//   const example: Record<string, any> = {};
//   questions.forEach(q => {
//     example[q.id] = q.type === "yes_no"
//       ? { value: "yes", confidence: 0.95 }
//       : q.type === "text"
//         ? { value: "", confidence: 0.90 }
//         : { value: null, confidence: 0.95 };
//   });

//   return `Page ${pageNum}: "${diaryPage.title}"

// ${questions.length} Yes/No questions. Each row has two bubbles:
// - LEFT = Yes(हाँ)   RIGHT = No(नहीं)
// One is FILLED (dark ink OR grey pencil shading — any mark inside the circle).
// The other is EMPTY (clean pink outline, white interior, no marks).
// Compare both bubbles: the one with MORE visual material inside is the answer.

// FIELDS:
// ${fieldList}

// Return this EXACT JSON (replace example values with actual readings):
// ${JSON.stringify(example, null, 2)}

// JSON only. No markdown. No explanation.`;
// }


// // ─────────────────────── SCHEDULE PAGES ──────────────────────

// function buildSchedulePrompt(diaryPage: DiaryPage): string {
//   const questions = diaryPage.questions.filter(q => q.type !== "info");
//   const pageNum = String(diaryPage.pageNumber).padStart(2, "0");

//   const dateFields = questions.filter(q => q.type === "date");
//   const statusFields = questions.filter(q => q.type === "select");
//   const yesNoFields = questions.filter(q => q.type === "yes_no");
//   const textFields = questions.filter(q => q.type === "text");
//   const hasSecond = dateFields.length > 1;

//   // ── Section instructions ──
//   let sections = "";

//   // First appointment
//   sections += buildAppointmentSection(
//     "FIRST APPOINTMENT (top box on the page)",
//     dateFields[0]?.id,
//     statusFields[0]?.id
//   );

//   // Second appointment
//   if (hasSecond) {
//     sections += buildAppointmentSection(
//       'SECOND ATTEMPT (bottom box, labeled "Second Attempt/द्वितीय प्रयास")',
//       dateFields[1]?.id,
//       statusFields[1]?.id
//     );
//   }

//   // Yes/No at bottom
//   for (const yn of yesNoFields) {
//     sections += `
// ═══ BOTTOM OF PAGE ═══
// "${yn.id}" — "${yn.text}": LEFT bubble = Yes(हाँ), RIGHT = No(नहीं). Which is dark?
// `;
//   }

//   // Text fields
//   for (const tf of textFields) {
//     sections += `\n"${tf.id}" — "${tf.text}": Read handwritten text on the dotted line, or "" if blank.\n`;
//   }

//   // ── Example output — UNIFORM { value, confidence } for ALL fields ──
//   const example: Record<string, { value: string | null; confidence: number }> = {};

//   if (dateFields[0]?.id)   example[dateFields[0].id]   = { value: "20/Sep/2028", confidence: 0.92 };
//   if (statusFields[0]?.id) example[statusFields[0].id] = { value: "Completed",   confidence: 0.93 };
//   if (hasSecond) {
//     if (dateFields[1]?.id)   example[dateFields[1].id]   = { value: "29/Jun/2028", confidence: 0.90 };
//     if (statusFields[1]?.id) example[statusFields[1].id] = { value: "Missed",      confidence: 0.91 };
//   }
//   for (const yn of yesNoFields) example[yn.id] = { value: null, confidence: 0.95 };
//   for (const tf of textFields)  example[tf.id] = { value: "",    confidence: 0.90 };

//   return `Page ${pageNum}: "${diaryPage.title}"

// This page has ${hasSecond ? "TWO appointment sections" : "ONE appointment section"}${yesNoFields.length ? " and a Yes/No question" : ""}.

// ═══ DATE READING RULE ═══
// Every bubble row is laid out as:  ○ Label  ○ Label  ○ Label
// The bubble (○) is BEFORE its label. To read a value:
//   1. Find the ONE bubble that is filled (dark ink OR grey pencil shading — any mark inside the circle)
//   2. Compare all bubbles in the row — the filled one has MORE visual material inside than the clean empty ones
//   3. Read the text printed IMMEDIATELY TO ITS RIGHT
//   4. That text is the value

// Example: ... ○ 19  ● 20  ○ 21 ...  (● = filled)
// → The filled bubble is before "20" → value = 20

// ${sections}

// ═══ REQUIRED OUTPUT ═══

// CRITICAL: Every field MUST use this format: { "value": <answer>, "confidence": <score> }
// - For dates: "value" must be a string in "DD/Mon/YYYY" format, e.g. "22/Sep/2027"
// - For status: "value" must be one of "Scheduled", "Completed", "Missed", "Cancelled"
// - For yes/no: "value" must be "yes" or "no"

// Return this EXACT JSON structure:
// ${JSON.stringify(example, null, 2)}

// Replace ALL example values with your actual readings from the image.
// JSON only. No markdown fences. No explanation. Start with { end with }.`;
// }

// function buildAppointmentSection(
//   sectionTitle: string,
//   dateId: string | undefined,
//   statusId: string | undefined
// ): string {
//   return `
// ═══ ${sectionTitle} ═══

// ${dateId ? `"${dateId}" — Read the date from three rows:` : ""}

// DD ROW ("DD: दिन"):
//   Two lines of bubbles:
//   Line 1: ○ 01  ○ 02  ○ 03  ○ 04  ○ 05  ○ 06  ○ 07  ○ 08  ○ 09  ○ 10  ○ 11  ○ 12  ○ 13  ○ 14  ○ 15  ○ 16
//   Line 2: ○ 17  ○ 18  ○ 19  ○ 20  ○ 21  ○ 22  ○ 23  ○ 24  ○ 25  ○ 26  ○ 27  ○ 28  ○ 29  ○ 30  ○ 31
//   Find the ONE dark bubble → number to its RIGHT = day

// MM ROW ("MM: माह"):
//   ○ Jan  ○ Feb  ○ Mar  ○ Apr  ○ May  ○ Jun  ○ Jul  ○ Aug  ○ Sep  ○ Oct  ○ Nov  ○ Dec
//   Find the ONE dark bubble → month name to its RIGHT = month (use 3-letter English: Jan, Feb, Mar...)

// YY ROW ("YY: साल"):
//   ○ 2026  ○ 2027  ○ 2028
//   Find the ONE dark bubble → year to its RIGHT = year

// Combine as "DD/Mon/YYYY". Example: day=22, month=Sep, year=2027 → "22/Sep/2027"

// ${statusId ? `"${statusId}" — Status row ("Status/स्थिति"):
//   ○ Scheduled  ○ Completed  ○ Missed  ○ Cancelled
//   Find the dark bubble → status word to its RIGHT` : ""}
// `;
// }


// // ═══════════════════════════════════════════════════════════════════════════════
// // 4. DATE RETRY PROMPT — for when date extraction fails
// // ═══════════════════════════════════════════════════════════════════════════════

// export function buildDateRetryPrompt(
//   diaryPage: DiaryPage,
//   dateFieldId: string,
//   sectionLabel: string
// ): string {
//   const pageNum = String(diaryPage.pageNumber).padStart(2, "0");

//   return `Page ${pageNum}: "${diaryPage.title}"

// CAREFULLY re-read the date in the "${sectionLabel}" section.

// STEP 1 — DD ROW ("DD: दिन"):
//   Line 1 bubbles: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16
//   Line 2 bubbles: 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
//   Which ONE bubble is dark? The number to its RIGHT = day.

// STEP 2 — MM ROW ("MM: माह"):
//   Bubbles: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec
//   Which ONE is dark? The month to its RIGHT = month.

// STEP 3 — YY ROW ("YY: साल"):
//   Bubbles: 2026, 2027, 2028
//   Which ONE is dark? The year to its RIGHT = year.

// Return JSON:
// { "${dateFieldId}": { "value": "DD/Mon/YYYY", "confidence": 0.90 } }

// Example: { "${dateFieldId}": { "value": "22/Sep/2027", "confidence": 0.92 } }

// JSON only. No markdown. No explanation.`;
// // ─────────────────────────────────────────────────────────────────────────────
// // PAGE DETECTION PROMPT — validates the uploaded image and extracts page number
// // ─────────────────────────────────────────────────────────────────────────────

// export const PAGE_DETECTION_PROMPT = `Analyze this photograph and determine whether it contains a printed CANTrac breast cancer diary page.

// STEP 1 — FIND THE DOCUMENT BOUNDARY:
// Look for FOUR BLACK SQUARE FIDUCIAL MARKERS at the corners of a rectangular printed document.
// These markers define the document region. EVERYTHING outside these four corners is background — ignore it completely.
// If you cannot find at least 3 of the 4 corner markers, the image likely does not contain a valid diary page.

// STEP 2 — VALIDATE THE DOCUMENT (inside the corner markers only):
// A valid CANTrac diary page has ALL of the following:
// - A 2-digit zero-padded page number printed prominently at the TOP CENTER (e.g., "03", "07", "29")
// - A QR code in the TOP-RIGHT area (near the top-right fiducial marker)
// - Pink/magenta colored horizontal bars alternating with white rows
// - Bilingual text in English and Hindi
// - A breast cancer ribbon logo near the top-left corner
// - Circular bubbles (Yes/No or date/status options) OR text fields with dotted lines

// STEP 3 — EXTRACT PAGE NUMBER:
// Read the large bold number at the top center of the document. It is always 2 digits (01–40).

// Return ONLY valid JSON (no markdown, no code fences, no explanation):

// If valid: { "isValidDiaryPage": true, "pageNumber": <number> }
// If invalid: { "isValidDiaryPage": false, "reason": "<brief reason>" }`;

// // ─────────────────────────────────────────────────────────────────────────────
// // SYSTEM PROMPT — sets the AI's role and core behavioral constraints
// // ─────────────────────────────────────────────────────────────────────────────

// export const VISION_SCAN_SYSTEM_PROMPT = `You are a precision medical document scanner. You extract structured data from mobile phone photographs of printed CANTrac breast cancer diary forms.

// CRITICAL: Patient treatment decisions depend on the accuracy of your extraction. Every field matters.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRINCIPLE 1: DOCUMENT ISOLATION — THE FIDUCIAL BOUNDARY RULE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Every CANTrac diary page has FOUR BLACK SQUARE MARKERS (fiducial markers) at its corners — top-left, top-right, bottom-left, bottom-right. These define the document boundary.

// YOUR PROCESSING REGION = the rectangular area enclosed by these four corner markers.
// EVERYTHING OUTSIDE this rectangle is background noise — table surfaces, fabric, skin, shadows, other papers, fingers, pens, etc. You MUST completely ignore it.

// How to apply this:
// 1. Locate all four black corner markers in the photograph.
// 2. Mentally draw a rectangle connecting them — this is your document.
// 3. If the document is rotated, tilted, or photographed at an angle, mentally correct for perspective before reading.
// 4. NEVER interpret any mark, color, or pattern outside this rectangle as document content.
// 5. Shadows falling across the document from external objects are NOT bubble fills — they are lighting artifacts.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRINCIPLE 2: BUBBLE DETECTION — THE CORE SKILL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Each question row has circular bubbles. Your job is to determine which bubble (if any) has been intentionally marked by a human.

// WHAT COUNTS AS A FILLED BUBBLE:
// - Dark pen ink (blue or black ballpoint) filling or coloring the interior
// - Gel pen ink (any color) inside the circle
// - Pencil shading — appears as grey/silver fill, often lighter than pen but clearly intentional
// - A cross mark (X) or check mark (✓) drawn inside the circle
// - Partial shading — at least ~20% of the interior has visible ink/graphite
// - A heavy dot or scribble intentionally placed inside the circle

// WHAT IS AN EMPTY BUBBLE:
// - A clean hollow circle — just the printed pink/light outline with NO ink inside
// - The circle interior matches the white/light background of the page
// - There may be very faint printing artifacts (tiny dots from the printer) — these are NOT fills

// WHAT IS NOT A BUBBLE FILL (ignore these):
// - Shadows from page curl, fingers, or lighting falling across a bubble
// - Background texture or surface pattern bleeding through thin paper
// - Stray ink marks or smudges that are clearly OUTSIDE the bubble circle
// - Printing registration marks or alignment dots that are part of the form design
// - The small square checkboxes in the leftmost column (those are for DOCTOR USE ONLY — never read them as patient answers)

// COMPARISON METHOD — always use this for Yes/No rows:
// 1. Look at the "Yes" bubble (LEFT side) and the "No" bubble (RIGHT side) simultaneously.
// 2. Compare their interiors side by side:
//    - If one is clearly darker/filled and the other is clearly empty → the darker one is selected.
//    - If both appear equally empty → the field is unanswered (null).
//    - If both appear filled → flag as ambiguous, report lower confidence.
//    - If one has a very faint mark and you're unsure → report the tentative answer with confidence 0.60–0.75.
// 3. NEVER default to "yes" or "no" when uncertain — use null with appropriate confidence.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRINCIPLE 3: DATE BUBBLE GRIDS — SCHEDULE PAGES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Schedule pages (07, 09, 11, 13, 15, 17, 19, 21, 23, 31, 34, 36, 37, 38) have date grids:
// - DD row: bubbles numbered 01–31 arranged in two rows of 16
// - MM row: bubbles labeled Jan–Dec (with Hindi translations below)
// - YY row: bubbles for 2026, 2027, 2028
// - Status row: Scheduled, Completed, Missed, Cancelled

// CRITICAL LAYOUT RULE — BUBBLE-TO-LABEL ALIGNMENT:
// Each bubble represents the label printed IMMEDIATELY TO ITS RIGHT (not to its left).
// The layout is: ○ 14  ○ 15  ○ 16 — so the bubble BEFORE "14" selects the value 14.
// This applies to ALL grid rows:
// - DD row: the filled bubble's value is the number printed to its RIGHT (e.g., ○ 15 means day = 15)
// - MM row: the filled bubble's value is the month name to its RIGHT (e.g., ○ Mar means month = Mar)
// - YY row: the filled bubble's value is the year to its RIGHT (e.g., ○ 2026 means year = 2026)
// - Status row: the filled bubble's value is the status label to its RIGHT (e.g., ○ Completed means status = Completed)

// For each row, scan ALL bubbles left-to-right. The one with visible ink/fill is the selected value.
// If NO bubble in a row is filled, that component is null/Unmarked.
// If you see fills in MULTIPLE bubbles of the same row, report the most clearly filled one but add a flag.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRINCIPLE 4: OUTPUT DISCIPLINE — ZERO TOLERANCE FOR HALLUCINATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// - Return ONLY valid JSON. No markdown code fences, no explanations, no preamble, no trailing text.
// - Start your response with { and end with }. Nothing else.
// - If you cannot see a field clearly, report it with low confidence — do NOT guess.
// - A null answer with high confidence (you're sure the bubble is empty) is BETTER than a wrong guess.
// - NEVER invent or hallucinate data that isn't visible in the image.
// - Every field listed in the extraction prompt MUST appear in your response — no omissions.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRINCIPLE 5: IMAGE QUALITY ADAPTATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Patients photograph these pages under varied conditions. Adapt your reading strategy:

// - GOOD LIGHTING, SHARP IMAGE: Read confidently. Confidence should be 0.90–1.00 for clear bubbles.
// - SLIGHT BLUR OR ANGLE: Still readable. Use the comparison method carefully. Confidence 0.80–0.95.
// - POOR LIGHTING / HEAVY SHADOWS: Focus on relative contrast between bubbles in the same row. A filled bubble will still be darker RELATIVE to its pair. Confidence 0.65–0.85.
// - VERY POOR / PARTIALLY OBSCURED: Report what you can see. Use null with low confidence for fields you cannot read. Confidence 0.50–0.70.
// - PAGE CREASE OR FOLD THROUGH A BUBBLE: The crease shadow is NOT a fill. Look for actual ink. Flag the field.

// REMEMBER: The document boundary is defined by the four black corner markers. Process ONLY what's inside them.`;

// // ─────────────────────────────────────────────────────────────────────────────
// // EXTRACTION PROMPT BUILDER — creates a per-page prompt from DiaryPage definitions
// // ─────────────────────────────────────────────────────────────────────────────

// export function buildExtractionPrompt(diaryPage: DiaryPage): string {
//     const questionLines = diaryPage.questions
//         .filter((q) => q.type !== "info")
//         .map((q) => {
//             let typeHint = "";
//             switch (q.type) {
//                 case "yes_no":
//                     typeHint = 'type: yes_no → return "yes" or "no" (lowercase). "Yes" bubble is on the LEFT, "No" is on the RIGHT.';
//                     break;
//                 case "date":
//                     typeHint =
//                         'type: date → return date string like "15/Mar/2026", or null if no bubbles filled. Read DD (01-31), MM (Jan-Dec), YY (2026-2028) bubble rows separately.';
//                     break;
//                 case "select":
//                     typeHint = `type: select → return exactly one of: ${(q.options || []).join(", ")}. Identify which option's bubble is filled.`;
//                     break;
//                 case "text":
//                     typeHint =
//                         "type: text → return the handwritten/printed text as a string, or empty string if blank. Read carefully, letter by letter.";
//                     break;
//             }
//             return `  - "${q.id}": "${q.text}" (${typeHint})`;
//         })
//         .join("\n");

//     const fieldCount = diaryPage.questions.filter((q) => q.type !== "info").length;

//     return `TASK: Extract filled bubble data from Page ${diaryPage.pageNumber}: "${diaryPage.title}" of the CANTrac Breast Cancer Diary.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 0: DOCUMENT BOUNDARY (do this FIRST before anything else)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 1. Locate the FOUR BLACK SQUARE FIDUCIAL MARKERS at the corners of the document.
// 2. These define your processing rectangle. IGNORE everything outside these markers.
// 3. Background objects (table, fabric, hands, shadows, pens, other papers) are NOT part of the document.
// 4. If the document is tilted or at an angle, mentally correct the perspective.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 1: VERIFY PAGE IDENTITY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Read the large page number at the top center of the document. Confirm it says "${String(diaryPage.pageNumber).padStart(2, '0')}".
// Read the title in the pink/magenta header bar. Confirm it matches or closely matches "${diaryPage.title}".

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 2: EXTRACT ALL ${fieldCount} FIELDS (scan top-to-bottom within the document boundary)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// FIELDS TO EXTRACT:
// ${questionLines}

// FOR EACH FIELD, follow this procedure:
// a. Locate the question row within the document (inside the fiducial markers).
// b. IGNORE the leftmost checkbox column — those small squares are for doctor use only.
// c. Find the circular response bubbles for this question.
// d. For Yes/No: "Yes(हाँ)" bubble is on the LEFT, "No(नहीं)" bubble is on the RIGHT.
// e. Compare BOTH bubbles side-by-side:
//    - Look at the interior of each circle.
//    - The one with MORE visible ink/shading/marks inside is the selected answer.
//    - If NEITHER has any mark → value is null (field is unanswered).
//    - A shadow from page curl or lighting is NOT a fill — look for actual ink.
// f. For date grids: scan DD row (01-31), MM row (Jan-Dec), YY row (2026-2028) separately.
//    Combine filled values into "DD/Mon/YYYY" format. If any component has no fill, the date is null.
// g. For select fields: identify which option bubble among the choices is filled.
// h. For text fields: read handwritten text character by character. Return empty string if blank.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STEP 3: ASSIGN CONFIDENCE SCORES — be honest
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// For each field, score your confidence in the extracted value:
// - 0.95–1.00: Crystal clear. Bubble is obviously filled or obviously empty. Sharp image, good lighting.
// - 0.85–0.94: Confident. Can see the mark clearly but minor image quality issues (slight blur, small shadow).
// - 0.70–0.84: Moderate. Mark is visible but there's ambiguity — faint pencil, slight shadow interference, or bubbles look somewhat similar.
// - 0.55–0.69: Uncertain. Hard to tell if a mark exists. Poor lighting, bubble partially obscured, or both bubbles look similar.
// - Below 0.55: Very uncertain. Significant issues. Report your best guess but the value may be wrong.

// SPECIAL CASE — Confident that a field is EMPTY:
// If NO bubble is marked at all (you're sure the field is unanswered), return value: null with confidence: 0.95.
// Being confident about emptiness is just as important as being confident about a fill.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OUTPUT FORMAT — strict JSON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Return a JSON object using the EXACT field IDs listed above as keys. Each value is an object with "value" and "confidence":

// {
//   "${diaryPage.questions.find((q) => q.type !== "info")?.id || "field_id"}": { "value": "yes", "confidence": 0.95 },
//   "another_field": { "value": null, "confidence": 0.95 },
//   "date_field": { "value": "15/Mar/2026", "confidence": 0.88 }
// }

// MANDATORY RULES:
// 1. Return ALL ${fieldCount} fields. Do not skip any.
// 2. Use the EXACT field IDs as JSON keys — copy them precisely from the list above.
// 3. For yes_no fields: lowercase "yes" or "no" only. Null if unanswered.
// 4. For unanswered fields (no bubble filled): value is null.
// 5. For date fields with partial fills (e.g., DD filled but MM not): return null for the whole date and add lower confidence.
// 6. Start with { and end with }. No markdown, no code fences, no explanation text.
// 7. NEVER read background elements outside the four corner fiducial markers as document content.`;
// }


// // ═══════════════════════════════════════════════════════════════════════════════
// // 5. ALL-NULL RETRY PROMPT
// // ═══════════════════════════════════════════════════════════════════════════════

// export function buildAllNullRetryPrompt(diaryPage: DiaryPage): string {
//   const questions = diaryPage.questions.filter(q => q.type !== "info");
//   const pageNum = String(diaryPage.pageNumber).padStart(2, "0");

//   const fieldList = questions.map(q => `"${q.id}": ${q.text} (${q.type})`).join("\n  ");

//   const example: Record<string, any> = {};
//   questions.forEach(q => {
//     example[q.id] = { value: q.type === "yes_no" ? "yes" : "example", confidence: 0.90 };
//   });

//   return `RETRY — Previous attempt returned all null. This is wrong. The form has filled bubbles.

// Page ${pageNum}: "${diaryPage.title}"

// Look at the page again. Filled bubbles are SOLID DARK circles. Empty ones are light pink outlines.

// Fields:
//   ${fieldList}

// Return: ${JSON.stringify(example, null, 2)}

// Replace with actual readings. JSON only.`;
// }


// // ═══════════════════════════════════════════════════════════════════════════════
// // 6. NORMALIZERS
// // ═══════════════════════════════════════════════════════════════════════════════

// function normalizeMonth(raw: any): string | null {
//   if (!raw || typeof raw !== "string") return null;
//   const t = raw.trim();
//   if (VALID_MONTHS.has(t)) return t;
//   return MONTH_MAP[t.toLowerCase()] || null;
// }

// function normalizeDay(raw: any): number | null {
//   const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
//   return (!isNaN(n) && n >= 1 && n <= 31) ? n : null;
// }

// function normalizeYear(raw: any): string | null {
//   const s = String(raw).trim();
//   if (VALID_YEARS.has(s)) return s;
//   if (/^\d{2}$/.test(s)) {
//     const full = "20" + s;
//     if (VALID_YEARS.has(full)) return full;
//   }
//   return null;
// }

// function parseDateString(s: string): { dd: number; mm: string; yy: string } | null {
//   if (!s) return null;

//   // "20/Sep/2028", "20-Sep-2028", "20 Sep 2028"
//   const m1 = s.match(/(\d{1,2})\s*[\/\-\s]\s*(\w+)\s*[\/\-\s]\s*(\d{4})/);
//   if (m1) {
//     const dd = normalizeDay(m1[1]), mm = normalizeMonth(m1[2]), yy = normalizeYear(m1[3]);
//     if (dd && mm && yy) return { dd, mm, yy };
//   }

//   // "Sep 20, 2028"
//   const m2 = s.match(/(\w+)\s*[\/\-\s,]\s*(\d{1,2})\s*[\/\-\s,]\s*(\d{4})/);
//   if (m2) {
//     const mm = normalizeMonth(m2[1]), dd = normalizeDay(m2[2]), yy = normalizeYear(m2[3]);
//     if (dd && mm && yy) return { dd, mm, yy };
//   }

//   // "2028-09-20" (ISO)
//   const m3 = s.match(/(\d{4})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{1,2})/);
//   if (m3) {
//     const yy = normalizeYear(m3[1]);
//     const monthNum = parseInt(m3[2], 10);
//     const dd = normalizeDay(m3[3]);
//     const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
//     const mm = (monthNum >= 1 && monthNum <= 12) ? months[monthNum - 1] : null;
//     if (dd && mm && yy) return { dd, mm, yy };
//   }

//   return null;
// }

// /**
//  * Extracts a date string from any response shape the AI might return.
//  * Handles: { value }, { date_string }, { dd, mm, yy }, { answer }, plain string
//  */
// function extractDateValue(raw: any): string | null {
//   if (typeof raw === "string") {
//     const p = parseDateString(raw);
//     return p ? `${String(p.dd).padStart(2, "0")}/${p.mm}/${p.yy}` : null;
//   }

//   if (!raw || typeof raw !== "object") return null;

//   // Try each possible key the AI might use for the combined date
//   for (const key of ["value", "date_string", "answer", "date"]) {
//     if (raw[key] && typeof raw[key] === "string") {
//       const p = parseDateString(raw[key]);
//       if (p) return `${String(p.dd).padStart(2, "0")}/${p.mm}/${p.yy}`;
//     }
//   }

//   // Decomposed: { dd, mm, yy }
//   if ("dd" in raw && "mm" in raw && "yy" in raw) {
//     const dd = normalizeDay(raw.dd);
//     const mm = normalizeMonth(raw.mm);
//     const yy = normalizeYear(raw.yy);
//     if (dd && mm && yy) return `${String(dd).padStart(2, "0")}/${mm}/${yy}`;
//   }

//   // Decomposed with different key names
//   if ("day" in raw && "month" in raw && "year" in raw) {
//     const dd = normalizeDay(raw.day);
//     const mm = normalizeMonth(raw.month);
//     const yy = normalizeYear(raw.year);
//     if (dd && mm && yy) return `${String(dd).padStart(2, "0")}/${mm}/${yy}`;
//   }

//   return null;
// }


// // ═══════════════════════════════════════════════════════════════════════════════
// // 7. RESPONSE MAPPER
// // ═══════════════════════════════════════════════════════════════════════════════

// export function mapResponseToBackend(
//   parsed: Record<string, any>,
//   diaryPage: DiaryPage
// ): Record<string, BackendScanResult> {
//   const questions: DiaryQuestion[] = diaryPage.questions.filter(q => q.type !== "info");
//   const results: Record<string, BackendScanResult> = {};

//   // Locate field data — handle nesting variations
//   const metaKeys = new Set([
//     "_page_verified", "_image_quality", "_retry_notes",
//     "page_number", "page_verified", "image_quality",
//     "error", "detected_page", "pageNumber", "title",
//   ]);

//   let fieldData: Record<string, any>;
//   if (parsed.fields && typeof parsed.fields === "object") {
//     fieldData = parsed.fields;
//   } else {
//     fieldData = {};
//     for (const [k, v] of Object.entries(parsed)) {
//       if (!metaKeys.has(k)) fieldData[k] = v;
//     }
//   }

//   for (const q of questions) {
//     let raw = fieldData[q.id];
//     const category = (q.type === "date" || q.type === "select") ? "schedule" : "general";

//     // Fuzzy key match
//     if (raw === undefined) {
//       const fuzzyKey = Object.keys(fieldData).find(k =>
//         k.toLowerCase().replace(/[_\-\s]/g, "") === q.id.toLowerCase().replace(/[_\-\s]/g, "")
//       );
//       if (fuzzyKey) raw = fieldData[fuzzyKey];
//     }

//     if (raw === undefined || raw === null) {
//       results[q.id] = { answer: null, category, confidence: 0, questionText: q.text };
//       continue;
//     }

//     // ── Extract value + confidence ──
//     let value: any = null;
//     let confidence = 0;

//     if (typeof raw === "object" && raw !== null) {
//       confidence = typeof raw.confidence === "number" ? raw.confidence : 0.85;

//       switch (q.type) {
//         case "date":
//           value = extractDateValue(raw);
//           break;

//         case "select":
//           value = raw.value ?? raw.answer ?? null;
//           if (value != null && q.options) {
//             const match = q.options.find(
//               o => o.toLowerCase() === String(value).toLowerCase().trim()
//             );
//             value = match || HINDI_STATUS_MAP[String(value).trim()] || null;
//           }
//           break;

//         case "yes_no":
//           value = raw.value ?? raw.answer ?? null;
//           if (value != null) {
//             const lower = String(value).toLowerCase().trim();
//             if (["yes", "हाँ", "haan", "true"].includes(lower)) value = "yes";
//             else if (["no", "नहीं", "nahi", "false"].includes(lower)) value = "no";
//             else value = null;
//           }
//           if (typeof value === "boolean") value = value ? "yes" : "no";
//           break;

//         default:
//           value = raw.value ?? raw.answer ?? null;
//       }
//     } else {
//       // Plain value (string, number, boolean)
//       confidence = 0.85;

//       switch (q.type) {
//         case "date":
//           value = extractDateValue(raw);
//           break;
//         case "yes_no": {
//           const lower = String(raw).toLowerCase().trim();
//           if (["yes", "हाँ", "true"].includes(lower)) value = "yes";
//           else if (["no", "नहीं", "false"].includes(lower)) value = "no";
//           else value = null;
//           break;
//         }
//         case "select":
//           if (q.options) {
//             const match = q.options.find(
//               o => o.toLowerCase() === String(raw).toLowerCase().trim()
//             );
//             value = match || null;
//           } else {
//             value = raw;
//           }
//           break;
//         default:
//           value = raw;
//       }
//     }

//     results[q.id] = {
//       answer: value,
//       category,
//       confidence: Math.min(Math.max(confidence, 0), 1),
//       questionText: q.text,
//     };
//   }

//   return results;
// }


// // ═══════════════════════════════════════════════════════════════════════════════
// // 8. VALIDATION
// // ═══════════════════════════════════════════════════════════════════════════════

// export function validateResults(
//   results: Record<string, BackendScanResult>,
//   diaryPage: DiaryPage
// ): ValidationResult {
//   const questions = diaryPage.questions.filter(q => q.type !== "info");
//   const expectedIds = questions.map(q => q.id);
//   const resultIds = new Set(Object.keys(results));

//   const missingFields = expectedIds.filter(id => !resultIds.has(id));
//   const allNull = Object.values(results).every(r => r.answer === null);
//   const badDates: string[] = [];
//   const lowConfidenceFields: string[] = [];
//   const errors: string[] = [];

//   for (const q of questions) {
//     const r = results[q.id];
//     if (!r) continue;

//     if (r.confidence > 0 && r.confidence < 0.7) lowConfidenceFields.push(q.id);

//     if (q.type === "date") {
//       if (r.answer === null && r.confidence > 0) {
//         // AI returned data but we couldn't parse it — flag for retry
//         badDates.push(q.id);
//         errors.push(`${q.id}: date returned but could not be parsed`);
//       } else if (r.answer !== null) {
//         const dateStr = String(r.answer);
//         const match = dateStr.match(/^(\d{2})\/(\w{3})\/(\d{4})$/);
//         if (!match) {
//           badDates.push(q.id);
//           errors.push(`${q.id}: invalid date format "${dateStr}"`);
//         } else {
//           const [, dayStr, month, year] = match;
//           const day = parseInt(dayStr, 10);
//           if (day < 1 || day > 31) { badDates.push(q.id); errors.push(`${q.id}: day ${day} out of range`); }
//           if (!VALID_MONTHS.has(month)) { badDates.push(q.id); errors.push(`${q.id}: invalid month "${month}"`); }
//           if (!VALID_YEARS.has(year)) { badDates.push(q.id); errors.push(`${q.id}: year "${year}" out of range`); }
//         }
//       }
//     }

//     if (q.type === "select" && r.answer !== null && q.options) {
//       if (!q.options.includes(r.answer as string)) {
//         errors.push(`${q.id}: "${r.answer}" not in [${q.options.join(", ")}]`);
//       }
//     }

//     if (q.type === "yes_no" && r.answer !== null) {
//       if (!["yes", "no"].includes(r.answer as string)) {
//         errors.push(`${q.id}: invalid yes_no value "${r.answer}"`);
//       }
//     }
//   }

//   if (missingFields.length > 0) errors.push(`Missing: ${missingFields.join(", ")}`);
//   if (allNull) errors.push("All null — likely extraction failure");

//   return { valid: errors.length === 0 && !allNull, allNull, missingFields, badDates, lowConfidenceFields, errors };
// }


// // ═══════════════════════════════════════════════════════════════════════════════
// // 9. JSON PARSER
// // ═══════════════════════════════════════════════════════════════════════════════

// export function parseLLMResponse<T>(raw: string): T {
//   if (!raw || typeof raw !== "string") throw new Error("Empty AI response");

//   const strategies: Array<() => T> = [
//     () => JSON.parse(raw),
//     () => JSON.parse(
//       raw.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/\s*```[\s\S]*$/, "").trim()
//     ),
//     () => { const m = raw.match(/\{[\s\S]*\}/); if (!m) throw 0; return JSON.parse(m[0]); },
//     () => {
//       const c = raw.replace(/[\u0000-\u001F\uFEFF\u200B-\u200D]/g, "");
//       const m = c.match(/\{[\s\S]*\}/); if (!m) throw 0; return JSON.parse(m[0]);
//     },
//     () => {
//       const m = raw.match(/\[[\s\S]*\]/); if (!m) throw 0;
//       const arr = JSON.parse(m[0]); return arr[0] as T;
//     },
//   ];

//   for (const s of strategies) { try { return s(); } catch { continue; } }
//   throw new Error(`JSON parse failed. Raw (500 chars): ${raw.slice(0, 500)}`);
// }


// // ═══════════════════════════════════════════════════════════════════════════════
// // 10. ORCHESTRATOR
// // ═══════════════════════════════════════════════════════════════════════════════

// export async function extractDiaryPage(
//   imageUrl: string,
//   diaryPage: DiaryPage,
//   callVisionAPI: (opts: {
//     system: string;
//     prompt: string;
//     imageUrl: string;
//     maxTokens: number;
//     temperature: number;
//     responseFormat: { type: string };
//   }) => Promise<string>
// ): Promise<Record<string, BackendScanResult>> {

//   const baseOpts = {
//     system: VISION_SCAN_SYSTEM_PROMPT,
//     imageUrl,
//     maxTokens: 1500,
//     temperature: 0.1,
//     responseFormat: { type: "json_object" },
//   };

//   // ── PASS 1: Primary extraction ──
//   const prompt = buildExtractionPrompt(diaryPage);
//   const raw1 = await callVisionAPI({ ...baseOpts, prompt });
//   console.log("[CANTrac] Raw AI response:", raw1);

//   const parsed1 = parseLLMResponse<Record<string, any>>(raw1);
//   console.log("[CANTrac] Parsed JSON:", JSON.stringify(parsed1, null, 2));

//   let results = mapResponseToBackend(parsed1, diaryPage);
//   let validation = validateResults(results, diaryPage);
//   console.log("[CANTrac] Pass 1 validation:", JSON.stringify(validation));

//   if (validation.valid) return results;

//   // ── PASS 2: All-null retry ──
//   if (validation.allNull) {
//     console.warn("[CANTrac] All null — retrying...");
//     const raw2 = await callVisionAPI({
//       ...baseOpts,
//       prompt: buildAllNullRetryPrompt(diaryPage),
//     });
//     const parsed2 = parseLLMResponse<Record<string, any>>(raw2);
//     const mapped2 = mapResponseToBackend(parsed2, diaryPage);
//     const v2 = validateResults(mapped2, diaryPage);

//     if (!v2.allNull) {
//       results = mapped2;
//       validation = v2;
//     } else {
//       console.warn("[CANTrac] Still all null after retry");
//       return results;
//     }
//   }

//   // ── PASS 3: Date-specific retry ──
//   if (validation.badDates.length > 0) {
//     for (const dateId of validation.badDates) {
//       const sectionLabel = dateId.includes("q1") || dateId.includes("first")
//         ? "First Appointment"
//         : "Second Attempt";

//       console.log(`[CANTrac] Retrying date field: ${dateId}`);
//       const rawRetry = await callVisionAPI({
//         ...baseOpts,
//         prompt: buildDateRetryPrompt(diaryPage, dateId, sectionLabel),
//       });
//       const parsedRetry = parseLLMResponse<Record<string, any>>(rawRetry);
//       const mappedRetry = mapResponseToBackend(parsedRetry, diaryPage);

//       if (mappedRetry[dateId]?.answer !== null) {
//         results[dateId] = mappedRetry[dateId];
//       }
//     }
//   }

//   // ── PASS 4: Low confidence field retry ──
//   if (validation.lowConfidenceFields.length > 0 && validation.lowConfidenceFields.length <= 5) {
//     const retryQuestions = diaryPage.questions.filter(
//       q => validation.lowConfidenceFields.includes(q.id)
//     );
//     const fieldLines = retryQuestions.map(q => `"${q.id}": ${q.text} (${q.type})`).join("\n  ");

//     const retryPrompt = `Re-examine these uncertain fields on Page ${diaryPage.pageNumber}:
//   ${fieldLines}

// Return JSON: { "<field_id>": { "value": ..., "confidence": ... }, ... }
// JSON only.`;

//     const rawRetry = await callVisionAPI({ ...baseOpts, prompt: retryPrompt });
//     const parsedRetry = parseLLMResponse<Record<string, any>>(rawRetry);
//     const mappedRetry = mapResponseToBackend(parsedRetry, diaryPage);

//     for (const [id, retryResult] of Object.entries(mappedRetry)) {
//       if (retryResult.answer !== null && retryResult.confidence > (results[id]?.confidence || 0)) {
//         results[id] = retryResult;
//       }
//     }
//   }

//   return results;
// }
import { DiaryPage } from "../../models/DiaryPage";

// ═══════════════════════════════════════════════════════════════════════════════
// CANTrac PRODUCTION PROMPT SYSTEM — v4 FINAL
// ═══════════════════════════════════════════════════════════════════════════════
// Consolidated single file. No duplicate declarations.
// All fields use uniform { "value": ..., "confidence": ... } output format.
// Date handling covers every response shape Gemini might return.
// ═══════════════════════════════════════════════════════════════════════════════


// ─────────────────────── TYPES ──────────────────────────

interface DiaryQuestion {
  id: string;
  text: string;
  type: string;
  options?: string[];
}

interface BackendScanResult {
  answer: string | number | boolean | null;
  category: string;
  confidence: number;
  questionText: string;
}

interface ValidationResult {
  valid: boolean;
  allNull: boolean;
  missingFields: string[];
  badDates: string[];
  lowConfidenceFields: string[];
  errors: string[];
}


// ─────────────────────── CONSTANTS ──────────────────────

const VALID_MONTHS = new Set([
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]);

const VALID_YEARS = new Set(["2026", "2027", "2028"]);

const MONTH_MAP: Record<string, string> = {
  // English lowercase
  jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", may: "May", jun: "Jun",
  jul: "Jul", aug: "Aug", sep: "Sep", oct: "Oct", nov: "Nov", dec: "Dec",
  // English full
  january: "Jan", february: "Feb", march: "Mar", april: "Apr",
  june: "Jun", july: "Jul", august: "Aug", september: "Sep",
  october: "Oct", november: "Nov", december: "Dec",
  // Hindi abbreviated
  "जन": "Jan", "फर": "Feb", "मार्च": "Mar", "अप्रैल": "Apr",
  "मई": "May", "जून": "Jun", "जुला": "Jul", "अग": "Aug",
  "सित": "Sep", "अक्तू": "Oct", "नव": "Nov", "दिस": "Dec",
  // Hindi full (only keys not already covered above)
  "जनवरी": "Jan", "फरवरी": "Feb", "जुलाई": "Jul", "अगस्त": "Aug",
  "सितंबर": "Sep", "अक्टूबर": "Oct", "नवंबर": "Nov", "दिसंबर": "Dec",
};

const HINDI_STATUS_MAP: Record<string, string> = {
  "सारणी": "Scheduled", "संपन्न": "Completed",
  "छूक गया": "Missed", "रद्": "Cancelled",
};


// ═══════════════════════════════════════════════════════════════════════════════
// 1. SYSTEM PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

export const VISION_SCAN_SYSTEM_PROMPT = `You are a medical form scanner extracting filled bubble data from photographs of CANTrac breast cancer diary pages.

FORM LAYOUT:
- Page bounded by 4 BLACK SQUARE corner markers. Only read INSIDE these markers.
- Ignore everything outside: table, fabric, hands, shadows, other papers.

BUBBLE APPEARANCE:
- FILLED bubbles can look different depending on the writing instrument:
  * BALLPOINT PEN: solid DARK BLUE/BLACK circle. Very high contrast against the white page.
  * GEL PEN: solid colored circle (blue, black, or other ink color). High contrast.
  * PENCIL/GRAPHITE: GREY or SILVER shaded circle. LOWER contrast than pen — appears as a soft grey fill rather than stark black. The interior looks CLOUDY, SMOKY, or HAZY compared to empty bubbles. May appear faint but is still clearly different from an empty bubble.
- EMPTY = thin PINK outline with WHITE/CLEAN interior. No ink or graphite inside. The interior is crisp and matches the page background.

KEY DETECTION RULE:
Compare bubble interiors RELATIVE TO EACH OTHER within the same row. The filled bubble — whether pen or pencil — will always have MORE visual material (darker, greyer, hazier) inside it than the empty bubbles in that same row. Even a faint pencil mark makes the bubble interior noticeably different from the clean, crisp empty bubbles nearby.

Do NOT require dark black ink to count as filled. ANY intentional mark — dark pen, light pencil, grey graphite — counts as a fill if the bubble interior looks different from empty bubbles in the same row.

RULES:
- If a bubble row has NO filled bubble (all circles are clean and empty), return null for that field with confidence 0.95 — do NOT guess or hallucinate a value.
- Only return a non-null value when you can clearly see a bubble with a mark inside it.
- Return ONLY valid JSON. No markdown. No explanation. No code fences. Start with { end with }.`;


// ═══════════════════════════════════════════════════════════════════════════════
// 2. PAGE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

export const PAGE_DETECTION_PROMPT = `What is the 2-digit page number at the top center of this CANTrac diary page?
Return JSON only: {"isValidDiaryPage": true, "pageNumber": <number>} or {"isValidDiaryPage": false, "reason": "<brief>"}`;


// ═══════════════════════════════════════════════════════════════════════════════
// 3. EXTRACTION PROMPT — MAIN ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

export function buildExtractionPrompt(diaryPage: DiaryPage): string {
  const types = new Set(
    diaryPage.questions.filter(q => q.type !== "info").map(q => q.type)
  );
  const isSchedule = types.has("date") || types.has("select");
  return isSchedule
    ? buildSchedulePrompt(diaryPage)
    : buildYesNoPrompt(diaryPage);
}


// ─────────────────────── YES/NO PAGES ──────────────────────

function buildYesNoPrompt(diaryPage: DiaryPage): string {
  const questions = diaryPage.questions.filter(q => q.type !== "info");
  const pageNum = String(diaryPage.pageNumber).padStart(2, "0");

  const fieldList = questions.map(q => {
    if (q.type === "yes_no")
      return `  "${q.id}": "${q.text}" → LEFT bubble = Yes, RIGHT bubble = No`;
    if (q.type === "text")
      return `  "${q.id}": "${q.text}" → read handwritten text, or "" if blank`;
    return `  "${q.id}": "${q.text}" → string | null`;
  }).join("\n");

  const example: Record<string, any> = {};
  questions.forEach(q => {
    example[q.id] = q.type === "yes_no"
      ? { value: null, confidence: 0.95 }
      : q.type === "text"
        ? { value: "", confidence: 0.90 }
        : { value: null, confidence: 0.95 };
  });

  return `Page ${pageNum}: "${diaryPage.title}"

${questions.length} Yes/No questions. Each row has two bubbles:
- LEFT = Yes(हाँ)   RIGHT = No(नहीं)
- A FILLED bubble has a visible mark inside it (pen ink, pencil shading, grey fill).
- An EMPTY bubble has a clean white interior with only a pink outline — no marks at all.

BLANK PAGE RULE: If BOTH bubbles in a row are empty (no marks in either), return null with confidence 0.95. Do NOT pick a side — null means the question was not answered.

FIELDS:
${fieldList}

Return this EXACT JSON structure:
${JSON.stringify(example, null, 2)}

- If a bubble IS filled, replace null with "yes" or "no" based on which side is filled.
- If NEITHER bubble is filled, keep value as null with confidence 0.95.
- Never copy example values — only return what you actually see in the image.
JSON only. No markdown. No explanation.`;
}


// ─────────────────────── SCHEDULE PAGES ──────────────────────

function buildSchedulePrompt(diaryPage: DiaryPage): string {
  const questions = diaryPage.questions.filter(q => q.type !== "info");
  const pageNum = String(diaryPage.pageNumber).padStart(2, "0");

  const dateFields = questions.filter(q => q.type === "date");
  const statusFields = questions.filter(q => q.type === "select");
  const yesNoFields = questions.filter(q => q.type === "yes_no");
  const textFields = questions.filter(q => q.type === "text");
  const hasSecond = dateFields.length > 1;

  // ── Section instructions ──
  let sections = "";

  // First appointment
  sections += buildAppointmentSection(
    "FIRST APPOINTMENT (top box on the page)",
    dateFields[0]?.id,
    statusFields[0]?.id
  );

  // Second appointment
  if (hasSecond) {
    sections += buildAppointmentSection(
      'SECOND ATTEMPT (bottom box, labeled "Second Attempt/द्वितीय प्रयास")',
      dateFields[1]?.id,
      statusFields[1]?.id
    );
  }

  // Yes/No at bottom
  for (const yn of yesNoFields) {
    sections += `
═══ BOTTOM OF PAGE ═══
"${yn.id}" — "${yn.text}": LEFT bubble = Yes(हाँ), RIGHT = No(नहीं). Which is dark?
`;
  }

  // Text fields
  for (const tf of textFields) {
    sections += `\n"${tf.id}" — "${tf.text}": Read handwritten text on the dotted line, or "" if blank.\n`;
  }

  // ── Example output — UNIFORM { value, confidence } for ALL fields ──
  const example: Record<string, { value: string | null; confidence: number }> = {};

  if (dateFields[0]?.id)   example[dateFields[0].id]   = { value: null, confidence: 0.95 };
  if (statusFields[0]?.id) example[statusFields[0].id] = { value: null, confidence: 0.95 };
  if (hasSecond) {
    if (dateFields[1]?.id)   example[dateFields[1].id]   = { value: null, confidence: 0.95 };
    if (statusFields[1]?.id) example[statusFields[1].id] = { value: null, confidence: 0.95 };
  }
  for (const yn of yesNoFields) example[yn.id] = { value: null, confidence: 0.95 };
  for (const tf of textFields)  example[tf.id] = { value: "",    confidence: 0.90 };

  return `Page ${pageNum}: "${diaryPage.title}"

This page has ${hasSecond ? "TWO appointment sections" : "ONE appointment section"}${yesNoFields.length ? " and a Yes/No question" : ""}.

═══ DATE READING RULE ═══
Every bubble row is laid out as:  ○ Label  ○ Label  ○ Label
The bubble (○) is BEFORE its label. To read a value:
  1. Find the ONE bubble that is filled (dark ink OR grey pencil shading — any mark inside the circle)
  2. Compare all bubbles in the row — the filled one has MORE visual material inside than the clean empty ones
  3. Read the text printed IMMEDIATELY TO ITS RIGHT
  4. That text is the value

Example: ... ○ 19  ● 20  ○ 21 ...  (● = filled)
→ The filled bubble is before "20" → value = 20

${sections}

═══ REQUIRED OUTPUT ═══

CRITICAL: Every field MUST use this format: { "value": <answer>, "confidence": <score> }
- For dates: "value" must be a string in "DD/Mon/YYYY" format, e.g. "22/Sep/2027" — or null if no bubble is filled
- For status: "value" must be one of "Scheduled", "Completed", "Missed", "Cancelled" — or null if no bubble is filled
- For yes/no: "value" must be "yes" or "no" — or null if neither bubble is filled

Return this EXACT JSON structure:
${JSON.stringify(example, null, 2)}

- If a bubble IS filled for a field, replace null with the actual value (date string, status word, "yes"/"no").
- If NO bubble is filled for a field, keep value as null with confidence 0.95.
- Never copy example values — only return what you actually see in the image.
JSON only. No markdown fences. No explanation. Start with { end with }.`;
}

function buildAppointmentSection(
  sectionTitle: string,
  dateId: string | undefined,
  statusId: string | undefined
): string {
  return `
═══ ${sectionTitle} ═══

${dateId ? `"${dateId}" — Read the date from three rows:` : ""}

DD ROW ("DD: दिन"):
  Two lines of bubbles:
  Line 1: ○ 01  ○ 02  ○ 03  ○ 04  ○ 05  ○ 06  ○ 07  ○ 08  ○ 09  ○ 10  ○ 11  ○ 12  ○ 13  ○ 14  ○ 15  ○ 16
  Line 2: ○ 17  ○ 18  ○ 19  ○ 20  ○ 21  ○ 22  ○ 23  ○ 24  ○ 25  ○ 26  ○ 27  ○ 28  ○ 29  ○ 30  ○ 31
  Find the ONE dark bubble → number to its RIGHT = day

MM ROW ("MM: माह"):
  ○ Jan  ○ Feb  ○ Mar  ○ Apr  ○ May  ○ Jun  ○ Jul  ○ Aug  ○ Sep  ○ Oct  ○ Nov  ○ Dec
  Find the ONE dark bubble → month name to its RIGHT = month (use 3-letter English: Jan, Feb, Mar...)

YY ROW ("YY: साल"):
  ○ 2026  ○ 2027  ○ 2028
  Find the ONE dark bubble → year to its RIGHT = year

Combine as "DD/Mon/YYYY". Example: day=22, month=Sep, year=2027 → "22/Sep/2027"

${statusId ? `"${statusId}" — Status row ("Status/स्थिति"):
  ○ Scheduled  ○ Completed  ○ Missed  ○ Cancelled
  Find the dark bubble → status word to its RIGHT` : ""}
`;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 4. DATE RETRY PROMPT — for when date extraction fails
// ═══════════════════════════════════════════════════════════════════════════════

export function buildDateRetryPrompt(
  diaryPage: DiaryPage,
  dateFieldId: string,
  sectionLabel: string
): string {
  const pageNum = String(diaryPage.pageNumber).padStart(2, "0");

  return `Page ${pageNum}: "${diaryPage.title}"

CAREFULLY re-read the date in the "${sectionLabel}" section.

STEP 1 — DD ROW ("DD: दिन"):
  Line 1 bubbles: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16
  Line 2 bubbles: 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
  Which ONE bubble is dark? The number to its RIGHT = day.

STEP 2 — MM ROW ("MM: माह"):
  Bubbles: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec
  Which ONE is dark? The month to its RIGHT = month.

STEP 3 — YY ROW ("YY: साल"):
  Bubbles: 2026, 2027, 2028
  Which ONE is dark? The year to its RIGHT = year.

Return JSON:
{ "${dateFieldId}": { "value": "DD/Mon/YYYY", "confidence": 0.90 } }

Example: { "${dateFieldId}": { "value": "22/Sep/2027", "confidence": 0.92 } }

JSON only. No markdown. No explanation.`;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 5. ALL-NULL RETRY PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

export function buildAllNullRetryPrompt(diaryPage: DiaryPage): string {
  const questions = diaryPage.questions.filter(q => q.type !== "info");
  const pageNum = String(diaryPage.pageNumber).padStart(2, "0");

  const fieldList = questions.map(q => `"${q.id}": ${q.text} (${q.type})`).join("\n  ");

  const example: Record<string, any> = {};
  questions.forEach(q => {
    example[q.id] = { value: q.type === "yes_no" ? "yes" : "example", confidence: 0.90 };
  });

  return `RETRY — Previous attempt returned all null. This is wrong. The form has filled bubbles.

Page ${pageNum}: "${diaryPage.title}"

Look at the page again. Filled bubbles are SOLID DARK circles. Empty ones are light pink outlines.

Fields:
  ${fieldList}

Return: ${JSON.stringify(example, null, 2)}

Replace with actual readings. JSON only.`;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 6. NORMALIZERS
// ═══════════════════════════════════════════════════════════════════════════════

function normalizeMonth(raw: any): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (VALID_MONTHS.has(t)) return t;
  return MONTH_MAP[t.toLowerCase()] || null;
}

function normalizeDay(raw: any): number | null {
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return (!isNaN(n) && n >= 1 && n <= 31) ? n : null;
}

function normalizeYear(raw: any): string | null {
  const s = String(raw).trim();
  if (VALID_YEARS.has(s)) return s;
  if (/^\d{2}$/.test(s)) {
    const full = "20" + s;
    if (VALID_YEARS.has(full)) return full;
  }
  return null;
}

function parseDateString(s: string): { dd: number; mm: string; yy: string } | null {
  if (!s) return null;

  // "20/Sep/2028", "20-Sep-2028", "20 Sep 2028"
  const m1 = s.match(/(\d{1,2})\s*[\/\-\s]\s*(\w+)\s*[\/\-\s]\s*(\d{4})/);
  if (m1) {
    const dd = normalizeDay(m1[1]), mm = normalizeMonth(m1[2]), yy = normalizeYear(m1[3]);
    if (dd && mm && yy) return { dd, mm, yy };
  }

  // "Sep 20, 2028"
  const m2 = s.match(/(\w+)\s*[\/\-\s,]\s*(\d{1,2})\s*[\/\-\s,]\s*(\d{4})/);
  if (m2) {
    const mm = normalizeMonth(m2[1]), dd = normalizeDay(m2[2]), yy = normalizeYear(m2[3]);
    if (dd && mm && yy) return { dd, mm, yy };
  }

  // "2028-09-20" (ISO)
  const m3 = s.match(/(\d{4})\s*[\/\-]\s*(\d{1,2})\s*[\/\-]\s*(\d{1,2})/);
  if (m3) {
    const yy = normalizeYear(m3[1]);
    const monthNum = parseInt(m3[2], 10);
    const dd = normalizeDay(m3[3]);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const mm = (monthNum >= 1 && monthNum <= 12) ? months[monthNum - 1] : null;
    if (dd && mm && yy) return { dd, mm, yy };
  }

  return null;
}

/**
 * Extracts a date string from any response shape the AI might return.
 * Handles: { value }, { date_string }, { dd, mm, yy }, { answer }, plain string
 */
function extractDateValue(raw: any): string | null {
  if (typeof raw === "string") {
    const p = parseDateString(raw);
    return p ? `${String(p.dd).padStart(2, "0")}/${p.mm}/${p.yy}` : null;
  }

  if (!raw || typeof raw !== "object") return null;

  // Try each possible key the AI might use for the combined date
  for (const key of ["value", "date_string", "answer", "date"]) {
    if (raw[key] && typeof raw[key] === "string") {
      const p = parseDateString(raw[key]);
      if (p) return `${String(p.dd).padStart(2, "0")}/${p.mm}/${p.yy}`;
    }
  }

  // Decomposed: { dd, mm, yy }
  if ("dd" in raw && "mm" in raw && "yy" in raw) {
    const dd = normalizeDay(raw.dd);
    const mm = normalizeMonth(raw.mm);
    const yy = normalizeYear(raw.yy);
    if (dd && mm && yy) return `${String(dd).padStart(2, "0")}/${mm}/${yy}`;
  }

  // Decomposed with different key names
  if ("day" in raw && "month" in raw && "year" in raw) {
    const dd = normalizeDay(raw.day);
    const mm = normalizeMonth(raw.month);
    const yy = normalizeYear(raw.year);
    if (dd && mm && yy) return `${String(dd).padStart(2, "0")}/${mm}/${yy}`;
  }

  return null;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 7. RESPONSE MAPPER
// ═══════════════════════════════════════════════════════════════════════════════

export function mapResponseToBackend(
  parsed: Record<string, any>,
  diaryPage: DiaryPage
): Record<string, BackendScanResult> {
  const questions: DiaryQuestion[] = diaryPage.questions.filter(q => q.type !== "info");
  const results: Record<string, BackendScanResult> = {};

  // Locate field data — handle nesting variations
  const metaKeys = new Set([
    "_page_verified", "_image_quality", "_retry_notes",
    "page_number", "page_verified", "image_quality",
    "error", "detected_page", "pageNumber", "title",
  ]);

  let fieldData: Record<string, any>;
  if (parsed.fields && typeof parsed.fields === "object") {
    fieldData = parsed.fields;
  } else {
    fieldData = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!metaKeys.has(k)) fieldData[k] = v;
    }
  }

  for (const q of questions) {
    let raw = fieldData[q.id];
    const category = (q.type === "date" || q.type === "select") ? "schedule" : "general";

    // Fuzzy key match
    if (raw === undefined) {
      const fuzzyKey = Object.keys(fieldData).find(k =>
        k.toLowerCase().replace(/[_\-\s]/g, "") === q.id.toLowerCase().replace(/[_\-\s]/g, "")
      );
      if (fuzzyKey) raw = fieldData[fuzzyKey];
    }

    if (raw === undefined || raw === null) {
      results[q.id] = { answer: null, category, confidence: 0, questionText: q.text };
      continue;
    }

    // ── Extract value + confidence ──
    let value: any = null;
    let confidence = 0;

    if (typeof raw === "object" && raw !== null) {
      confidence = typeof raw.confidence === "number" ? raw.confidence : 0.85;

      switch (q.type) {
        case "date":
          value = extractDateValue(raw);
          break;

        case "select":
          value = raw.value ?? raw.answer ?? null;
          if (value != null && q.options) {
            const match = q.options.find(
              o => o.toLowerCase() === String(value).toLowerCase().trim()
            );
            value = match || HINDI_STATUS_MAP[String(value).trim()] || null;
          }
          break;

        case "yes_no":
          value = raw.value ?? raw.answer ?? null;
          if (value != null) {
            const lower = String(value).toLowerCase().trim();
            if (["yes", "हाँ", "haan", "true"].includes(lower)) value = "yes";
            else if (["no", "नहीं", "nahi", "false"].includes(lower)) value = "no";
            else value = null;
          }
          if (typeof value === "boolean") value = value ? "yes" : "no";
          break;

        default:
          value = raw.value ?? raw.answer ?? null;
      }
    } else {
      // Plain value (string, number, boolean)
      confidence = 0.85;

      switch (q.type) {
        case "date":
          value = extractDateValue(raw);
          break;
        case "yes_no": {
          const lower = String(raw).toLowerCase().trim();
          if (["yes", "हाँ", "true"].includes(lower)) value = "yes";
          else if (["no", "नहीं", "false"].includes(lower)) value = "no";
          else value = null;
          break;
        }
        case "select":
          if (q.options) {
            const match = q.options.find(
              o => o.toLowerCase() === String(raw).toLowerCase().trim()
            );
            value = match || null;
          } else {
            value = raw;
          }
          break;
        default:
          value = raw;
      }
    }

    results[q.id] = {
      answer: value,
      category,
      confidence: Math.min(Math.max(confidence, 0), 1),
      questionText: q.text,
    };
  }

  return results;
}


// ═══════════════════════════════════════════════════════════════════════════════
// 8. VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

export function validateResults(
  results: Record<string, BackendScanResult>,
  diaryPage: DiaryPage
): ValidationResult {
  const questions = diaryPage.questions.filter(q => q.type !== "info");
  const expectedIds = questions.map(q => q.id);
  const resultIds = new Set(Object.keys(results));

  const missingFields = expectedIds.filter(id => !resultIds.has(id));
  const allNull = Object.values(results).every(r => r.answer === null);
  const badDates: string[] = [];
  const lowConfidenceFields: string[] = [];
  const errors: string[] = [];

  for (const q of questions) {
    const r = results[q.id];
    if (!r) continue;

    if (r.confidence > 0 && r.confidence < 0.7) lowConfidenceFields.push(q.id);

    if (q.type === "date") {
      if (r.answer === null && r.confidence > 0) {
        // AI returned data but we couldn't parse it — flag for retry
        badDates.push(q.id);
        errors.push(`${q.id}: date returned but could not be parsed`);
      } else if (r.answer !== null) {
        const dateStr = String(r.answer);
        const match = dateStr.match(/^(\d{2})\/(\w{3})\/(\d{4})$/);
        if (!match) {
          badDates.push(q.id);
          errors.push(`${q.id}: invalid date format "${dateStr}"`);
        } else {
          const [, dayStr, month, year] = match;
          const day = parseInt(dayStr, 10);
          if (day < 1 || day > 31) { badDates.push(q.id); errors.push(`${q.id}: day ${day} out of range`); }
          if (!VALID_MONTHS.has(month)) { badDates.push(q.id); errors.push(`${q.id}: invalid month "${month}"`); }
          if (!VALID_YEARS.has(year)) { badDates.push(q.id); errors.push(`${q.id}: year "${year}" out of range`); }
        }
      }
    }

    if (q.type === "select" && r.answer !== null && q.options) {
      if (!q.options.includes(r.answer as string)) {
        errors.push(`${q.id}: "${r.answer}" not in [${q.options.join(", ")}]`);
      }
    }

    if (q.type === "yes_no" && r.answer !== null) {
      if (!["yes", "no"].includes(r.answer as string)) {
        errors.push(`${q.id}: invalid yes_no value "${r.answer}"`);
      }
    }
  }

  if (missingFields.length > 0) errors.push(`Missing: ${missingFields.join(", ")}`);
  if (allNull) errors.push("All null — likely extraction failure");

  return { valid: errors.length === 0 && !allNull, allNull, missingFields, badDates, lowConfidenceFields, errors };
}


// ═══════════════════════════════════════════════════════════════════════════════
// 9. JSON PARSER
// ═══════════════════════════════════════════════════════════════════════════════

export function parseLLMResponse<T>(raw: string): T {
  if (!raw || typeof raw !== "string") throw new Error("Empty AI response");

  const strategies: Array<() => T> = [
    () => JSON.parse(raw),
    () => JSON.parse(
      raw.replace(/^[\s\S]*?```(?:json)?\s*/i, "").replace(/\s*```[\s\S]*$/, "").trim()
    ),
    () => { const m = raw.match(/\{[\s\S]*\}/); if (!m) throw 0; return JSON.parse(m[0]); },
    () => {
      const c = raw.replace(/[\u0000-\u001F\uFEFF\u200B-\u200D]/g, "");
      const m = c.match(/\{[\s\S]*\}/); if (!m) throw 0; return JSON.parse(m[0]);
    },
    () => {
      const m = raw.match(/\[[\s\S]*\]/); if (!m) throw 0;
      const arr = JSON.parse(m[0]); return arr[0] as T;
    },
  ];

  for (const s of strategies) { try { return s(); } catch { continue; } }
  throw new Error(`JSON parse failed. Raw (500 chars): ${raw.slice(0, 500)}`);
}


// ═══════════════════════════════════════════════════════════════════════════════
// 10. ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

export async function extractDiaryPage(
  imageUrl: string,
  diaryPage: DiaryPage,
  callVisionAPI: (opts: {
    system: string;
    prompt: string;
    imageUrl: string;
    maxTokens: number;
    temperature: number;
    responseFormat: { type: string };
  }) => Promise<string>
): Promise<Record<string, BackendScanResult>> {

  const baseOpts = {
    system: VISION_SCAN_SYSTEM_PROMPT,
    imageUrl,
    maxTokens: 1500,
    temperature: 0.1,
    responseFormat: { type: "json_object" },
  };

  // ── PASS 1: Primary extraction ──
  const prompt = buildExtractionPrompt(diaryPage);
  const raw1 = await callVisionAPI({ ...baseOpts, prompt });
  console.log("[CANTrac] Raw AI response:", raw1);

  const parsed1 = parseLLMResponse<Record<string, any>>(raw1);
  console.log("[CANTrac] Parsed JSON:", JSON.stringify(parsed1, null, 2));

  let results = mapResponseToBackend(parsed1, diaryPage);
  let validation = validateResults(results, diaryPage);
  console.log("[CANTrac] Pass 1 validation:", JSON.stringify(validation));

  if (validation.valid) return results;

  // ── PASS 2: All-null retry ──
  if (validation.allNull) {
    console.warn("[CANTrac] All null — retrying...");
    const raw2 = await callVisionAPI({
      ...baseOpts,
      prompt: buildAllNullRetryPrompt(diaryPage),
    });
    const parsed2 = parseLLMResponse<Record<string, any>>(raw2);
    const mapped2 = mapResponseToBackend(parsed2, diaryPage);
    const v2 = validateResults(mapped2, diaryPage);

    if (!v2.allNull) {
      results = mapped2;
      validation = v2;
    } else {
      console.warn("[CANTrac] Still all null after retry");
      return results;
    }
  }

  // ── PASS 3: Date-specific retry ──
  if (validation.badDates.length > 0) {
    for (const dateId of validation.badDates) {
      const sectionLabel = dateId.includes("q1") || dateId.includes("first")
        ? "First Appointment"
        : "Second Attempt";

      console.log(`[CANTrac] Retrying date field: ${dateId}`);
      const rawRetry = await callVisionAPI({
        ...baseOpts,
        prompt: buildDateRetryPrompt(diaryPage, dateId, sectionLabel),
      });
      const parsedRetry = parseLLMResponse<Record<string, any>>(rawRetry);
      const mappedRetry = mapResponseToBackend(parsedRetry, diaryPage);

      if (mappedRetry[dateId]?.answer !== null) {
        results[dateId] = mappedRetry[dateId];
      }
    }
  }

  // ── PASS 4: Low confidence field retry ──
  if (validation.lowConfidenceFields.length > 0 && validation.lowConfidenceFields.length <= 5) {
    const retryQuestions = diaryPage.questions.filter(
      q => validation.lowConfidenceFields.includes(q.id)
    );
    const fieldLines = retryQuestions.map(q => `"${q.id}": ${q.text} (${q.type})`).join("\n  ");

    const retryPrompt = `Re-examine these uncertain fields on Page ${diaryPage.pageNumber}:
  ${fieldLines}

Return JSON: { "<field_id>": { "value": ..., "confidence": ... }, ... }
JSON only.`;

    const rawRetry = await callVisionAPI({ ...baseOpts, prompt: retryPrompt });
    const parsedRetry = parseLLMResponse<Record<string, any>>(rawRetry);
    const mappedRetry = mapResponseToBackend(parsedRetry, diaryPage);

    for (const [id, retryResult] of Object.entries(mappedRetry)) {
      if (retryResult.answer !== null && retryResult.confidence > (results[id]?.confidence || 0)) {
        results[id] = retryResult;
      }
    }
  }

  return results;
}