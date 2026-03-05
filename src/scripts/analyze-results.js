const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "../../gemini-ocr-results");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort();

let totalIn = 0, totalOut = 0, success = 0, failed = 0;

for (const file of files) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
  const u = d.tokenUsage || {};
  const inp = u.promptTokens || 0;
  const out = u.responseTokens || 0;
  const cost = ((inp / 1e6) * 0.10) + ((out / 1e6) * 0.40);
  const hasErr = "error" in d.extraction;

  totalIn += inp;
  totalOut += out;

  console.log("=".repeat(60));
  console.log("FILE:", file);
  console.log("  Status:", hasErr ? "FAILED" : "SUCCESS");
  console.log("  Size:", d.originalSizeKB + "KB | Time:", d.processingTimeMs + "ms");
  console.log("  Tokens:", inp, "in +", out, "out =", (inp + out), "total");
  console.log("  Cost: $" + cost.toFixed(6));

  if (!hasErr) {
    success++;
    const e = d.extraction;
    console.log("  Page:", e.page_number, "|", e.page_title);
    console.log("  Overall:", e.overall_confidence || e.confidence);
    for (const s of (e.sections || e.questions || [])) {
      if (s.section_title) console.log("  [" + s.section_title + "]");
      for (const f of (s.fields || [])) {
        const val = f.value !== null ? f.value : "(empty)";
        const conf = f.confidence !== undefined ? " (" + f.confidence + ")" : "";
        const flag = f.confidence !== undefined && f.confidence < 0.8 ? " ⚠️" : "";
        console.log("    ->", f.field + ":", "[" + val + "]" + conf + flag);
      }
      // Legacy format support
      if (s.question_text) {
        console.log("    ->", s.question_text + ":", "[" + s.selected_answer + "]");
      }
    }
    if (e.notes) console.log("  Notes:", e.notes);
  } else {
    failed++;
    console.log("  Error:", d.extraction.error);
  }
  console.log();
}

const totalCost = ((totalIn / 1e6) * 0.10) + ((totalOut / 1e6) * 0.40);
const perImage = totalCost / Math.max(files.length, 1);

console.log("=".repeat(60));
console.log("TOTALS");
console.log("=".repeat(60));
console.log("  Images:", files.length, "(", success, "success,", failed, "failed )");
console.log("  Total tokens:", totalIn, "in +", totalOut, "out");
console.log("  Total cost:      $" + totalCost.toFixed(6));
console.log("  Per image:       $" + perImage.toFixed(6));
console.log("  Projected 1K:    $" + (perImage * 1000).toFixed(2));
console.log("  Projected 40K:   $" + (perImage * 40000).toFixed(2));
