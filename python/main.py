"""
CANTrac Vision Scanner — Pure AI extraction.

No OpenCV preprocessing. Send raw photo directly to GPT-4o.
Simple, reliable, no fragile image processing.
"""

import os
import json
import base64
import time
import httpx
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from contextlib import asynccontextmanager

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIG
# ═══════════════════════════════════════════════════════════════════════════════

OPENROUTER_API_KEY = "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"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
PRIMARY_MODEL = os.getenv("VISION_PRIMARY_MODEL", "openai/gpt-4o")
VERIFY_MODEL = os.getenv("VISION_VERIFY_MODEL", "google/gemini-2.5-flash")
HTTP_REFERER = "https://onehealtech.com"
APP_TITLE = "CANTrac Vision Scanner"

SYSTEM_PROMPT = """You are an expert medical form scanner reading CANTrac breast cancer diary pages from phone photographs.

FORM LAYOUT:
- Pages have bordered boxes for appointment sections.
- Each box has bubble rows: DD (01-31), MM (Jan-Dec in English AND Hindi), YY (2026/2027/2028), Status.
- Some pages also have Yes/No questions with two bubbles per row.

BUBBLE READING RULE:
- Each bubble (circle) sits TO THE LEFT of its label/number.
- Layout: ○ 06  ● 07  ○ 08 — the filled bubble (●) is before "07", so value = 07.
- A FILLED bubble has dark ink or pencil shading inside.
- An EMPTY bubble has only a light pink outline with white/clean interior.
- Always read the label TO THE RIGHT of the filled bubble.

MONTH ROWS:
- Two lines: English (Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec) and Hindi (same 12 months).
- The fill can be in EITHER line. Both represent the same month.
- Always return the 3-letter English name (Jan, Feb, Mar, etc.).

SECTIONS:
- "First Appointment" = top bordered box.
- "Second Attempt" = bottom bordered box.
- Read each section INDEPENDENTLY. Never mix data between boxes.

Return ONLY valid JSON. No markdown fences. No explanation."""


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not OPENROUTER_API_KEY:
        print("[WARN] OPENROUTER_API_KEY not set")
    print(f"[INFO] Primary: {PRIMARY_MODEL}, Verify: {VERIFY_MODEL}")
    yield

app = FastAPI(title="CANTrac Vision Scanner", lifespan=lifespan)


# ═══════════════════════════════════════════════════════════════════════════════
# AI CALL
# ═══════════════════════════════════════════════════════════════════════════════

async def call_ai(image_b64: str, mime: str, prompt: str, model: str, max_tokens: int = 1024) -> str:
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not configured")

    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
            ]},
        ],
        "temperature": 0,
        "max_tokens": max_tokens,
    }

    timeout = httpx.Timeout(connect=15, read=180, write=60, pool=15)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            OPENROUTER_URL, json=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "HTTP-Referer": HTTP_REFERER,
                "X-Title": APP_TITLE,
            },
        )

    if resp.status_code != 200:
        raise RuntimeError(f"API error ({resp.status_code}): {resp.text[:300]}")

    data = resp.json()
    if data.get("error"):
        raise RuntimeError(f"AI error: {data['error']}")

    return data.get("choices", [{}])[0].get("message", {}).get("content", "")


def parse_json(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        print(f"[WARN] JSON parse failed: {text[:300]}")
        return {}


# ═══════════════════════════════════════════════════════════════════════════════
# EXTRACTION PROMPT
# ═══════════════════════════════════════════════════════════════════════════════

def build_prompt(questions: list, page_title: str = "") -> str:
    field_lines = []
    for q in questions:
        qid = q.get("id")
        qtype = q.get("type")
        qtext = q.get("text", "")

        if qtype == "info":
            continue

        section = ""
        if "1" in qid:
            section = " [FIRST APPOINTMENT - top box]"
        elif "2" in qid:
            section = " [SECOND ATTEMPT - bottom box]"

        if qtype == "date":
            field_lines.append(
                f'  "{qid}"{section}: Read DD (01-31), MM (Jan-Dec), YY (2026/2027/2028) → "DD/Mon/YYYY"'
            )
        elif qtype == "select":
            opts = q.get("options", ["Scheduled", "Completed", "Missed", "Cancelled"])
            field_lines.append(
                f'  "{qid}"{section}: Status → one of: {", ".join(opts)}'
            )
        elif qtype == "yes_no":
            field_lines.append(
                f'  "{qid}": "{qtext}" → LEFT bubble = "yes", RIGHT bubble = "no"'
            )
        elif qtype == "text":
            field_lines.append(
                f'  "{qid}": "{qtext}" → handwritten text, or "" if blank'
            )

    return f"""This is a phone photograph of CANTrac diary page "{page_title}".

Extract ALL these fields by reading the filled bubbles:

{chr(10).join(field_lines)}

For each field, return the value and your confidence (0.0 to 1.0).

Return JSON:
{{
  "<field_id>": {{ "value": "<answer>", "confidence": <0.0-1.0> }},
  ...
}}

Rules:
- Dates: "DD/Mon/YYYY" format (e.g. "07/Jan/2028"). null if not filled.
- Status: exactly "Scheduled", "Completed", "Missed", or "Cancelled". null if not filled.
- Yes/No: lowercase "yes" or "no". null if not filled.
- Include ALL fields listed above."""


# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"status": "ok", "primary": PRIMARY_MODEL, "verify": VERIFY_MODEL}


@app.post("/process-scan")
async def process_scan(
    image: UploadFile = File(...),
    questions: str = Form(...),
    page_title: str = Form(""),
):
    start = time.time()

    # Read and optimize image before sending to AI
    contents = await image.read()
    mime = "image/jpeg"

    import cv2
    nparr = np.frombuffer(contents, np.uint8)
    img_cv = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_cv is None:
        raise HTTPException(status_code=400, detail="Cannot decode image")

    original_size = len(contents) // 1024
    h, w = img_cv.shape[:2]

    # 1. Resize — max 2000px longest side
    max_side = 2000
    if max(h, w) > max_side:
        scale = max_side / max(h, w)
        img_cv = cv2.resize(img_cv, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    # 2. Auto white-balance — normalize lighting for different conditions
    lab = cv2.cvtColor(img_cv, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    img_cv = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)

    # 3. Sharpen — make bubble edges and text clearer
    kernel = np.array([[0, -0.5, 0], [-0.5, 3, -0.5], [0, -0.5, 0]])
    img_cv = cv2.filter2D(img_cv, -1, kernel)

    # 4. Encode as JPEG
    _, buf = cv2.imencode(".jpg", img_cv, [cv2.IMWRITE_JPEG_QUALITY, 88])
    img_b64 = base64.b64encode(buf).decode("utf-8")

    print(f"[SCAN] Optimized: {original_size}KB → {len(buf) // 1024}KB, {img_cv.shape[1]}x{img_cv.shape[0]}")

    # Parse questions
    try:
        q_list = json.loads(questions)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid questions JSON")

    if not isinstance(q_list, list):
        raise HTTPException(status_code=400, detail="questions must be a JSON array")

    q_map = {q["id"]: q for q in q_list if q.get("type") != "info"}
    prompt = build_prompt(q_list, page_title)

    print(f"[SCAN] {len(q_map)} fields, title={page_title}")

    # --- Pass 1: GPT-4o (primary) ---
    primary_results = {}
    ai_answered = 0

    try:
        print(f"[PASS-1] {PRIMARY_MODEL}...")
        raw = await call_ai(img_b64, mime, prompt, PRIMARY_MODEL)
        print(f"[PASS-1] {raw[:500]}")
        parsed = parse_json(raw)

        for qid, val in parsed.items():
            value = val.get("value") if isinstance(val, dict) else val
            conf = val.get("confidence", 0.9) if isinstance(val, dict) else 0.9
            primary_results[qid] = {"value": value, "confidence": conf}
            if value is not None:
                ai_answered += 1
            print(f"  [{qid}] → {value} (conf={conf})")
    except Exception as e:
        print(f"[PASS-1] FAILED: {e}")

    # --- Pass 2: Verify nulls/low-confidence with Gemini Flash ---
    needs_verify = [
        qid for qid in q_map
        if qid not in primary_results
        or primary_results[qid]["value"] is None
        or primary_results[qid]["confidence"] < 0.6
    ]

    if needs_verify:
        print(f"[PASS-2] {VERIFY_MODEL} for {len(needs_verify)} fields: {needs_verify}")
        try:
            raw2 = await call_ai(img_b64, mime, prompt, VERIFY_MODEL)
            print(f"[PASS-2] {raw2[:500]}")
            parsed2 = parse_json(raw2)

            for qid in needs_verify:
                if qid in parsed2:
                    val2 = parsed2[qid]
                    value2 = val2.get("value") if isinstance(val2, dict) else val2
                    conf2 = val2.get("confidence", 0.85) if isinstance(val2, dict) else 0.85

                    existing = primary_results.get(qid, {})
                    if value2 is not None and (existing.get("value") is None or conf2 > existing.get("confidence", 0)):
                        primary_results[qid] = {"value": value2, "confidence": conf2}
                        if existing.get("value") is None:
                            ai_answered += 1
                        print(f"  [{qid}] VERIFIED → {value2}")
        except Exception as e:
            print(f"[PASS-2] FAILED: {e}")
    else:
        print("[PASS-2] Skipped — all fields answered by primary")

    # --- Build final ---
    final = {}
    for qid, q_info in q_map.items():
        r = primary_results.get(qid, {})
        final[qid] = {
            "answer": r.get("value"),
            "confidence": r.get("confidence", 0.0),
            "questionText": q_info.get("text", ""),
            "category": q_info.get("category", ""),
        }

    total_ms = int((time.time() - start) * 1000)
    total_fields = len(final)
    print(f"[SCAN] Done: {ai_answered}/{total_fields} in {total_ms}ms")

    return {
        "success": True,
        "extraction": final,
        "metadata": {
            "model": f"{PRIMARY_MODEL}+{VERIFY_MODEL}",
            "alignment": "raw",
            "totalFields": total_fields,
            "omrAnswered": 0,
            "aiAnswered": ai_answered,
            "unanswered": total_fields - ai_answered,
            "processingTimeMs": total_ms,
        },
    }


@app.post("/detect-page")
async def detect_page(image: UploadFile = File(...)):
    contents = await image.read()
    mime = image.content_type or "image/jpeg"
    b64 = base64.b64encode(contents).decode("utf-8")

    prompt = (
        'What is the 2-digit page number at the top center of this CANTrac diary page?\n'
        'Return JSON only: {"isValidDiaryPage": true, "pageNumber": <number>} '
        'or {"isValidDiaryPage": false, "reason": "<brief>"}'
    )

    try:
        raw = await call_ai(b64, mime, prompt, PRIMARY_MODEL, max_tokens=100)
        return parse_json(raw)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("VISION_PROCESSOR_PORT", "8001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
