#!/usr/bin/env python3
"""
OCR + OMR Processor for Digital Diary Pages
Usage: python3 ocr_processor.py <image_path> [--page-type <type>]
Output: JSON to stdout
Errors: Messages to stderr, non-zero exit code

Supports:
- Plain text OCR extraction (general diary pages)
- OMR bubble detection for questionnaire forms (YES/NO, multiple choice)
"""
import sys
import json
import argparse
import re
import time
from pathlib import Path

import cv2
import numpy as np
import pytesseract
from PIL import Image


# ---------------------------------------------------------------------------
# OMR (Optical Mark Recognition) Functions
# ---------------------------------------------------------------------------

def detect_answer_columns(cv_img_gray):
    """
    Detect YES/NO answer bubble columns.
    Finds the two dominant x-clusters of circles in the right portion of the image.
    Returns (yes_x, no_x) center positions.
    """
    h, w = cv_img_gray.shape
    blurred = cv2.GaussianBlur(cv_img_gray, (5, 5), 0)

    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=20,
        param1=50,
        param2=25,
        minRadius=8,
        maxRadius=30,
    )

    if circles is None:
        return None, None, []

    circles = np.uint16(np.around(circles[0]))

    # Filter: right portion, reasonable radius, below header area (y > 25% of height)
    right_threshold = w * 0.55
    min_y = h * 0.25
    candidates = []
    for (cx, cy, r) in circles:
        if cx >= right_threshold and r >= 10 and r <= 22 and cy > min_y:
            candidates.append((int(cx), int(cy), int(r)))

    if len(candidates) < 4:
        return None, None, candidates

    # Cluster x-positions to find the two answer columns
    x_positions = sorted(set(c[0] for c in candidates))
    if len(x_positions) < 2:
        return None, None, candidates

    # Find two clusters: group x values within 20px of each other
    clusters = []
    current_cluster = [x_positions[0]]
    for x in x_positions[1:]:
        if x - current_cluster[-1] <= 20:
            current_cluster.append(x)
        else:
            clusters.append(current_cluster)
            current_cluster = [x]
    clusters.append(current_cluster)

    if len(clusters) < 2:
        return None, None, candidates

    # Take the two largest clusters
    clusters.sort(key=lambda c: -len(c))
    yes_x = int(np.mean(clusters[0]))
    no_x = int(np.mean(clusters[1]))

    # Ensure YES is left of NO
    if yes_x > no_x:
        yes_x, no_x = no_x, yes_x

    return yes_x, no_x, candidates


def analyze_bubbles(cv_img_gray, candidates, yes_x, no_x, num_questions):
    """
    Analyze each candidate circle to determine if filled.
    Uses center pixel intensity (inner 50% radius) to distinguish
    filled (solid dark) from unfilled (outlined, light center).
    """
    x_tolerance = 15
    results = []

    for (cx, cy, r) in candidates:
        # Classify as YES or NO based on x-position
        if abs(cx - yes_x) <= x_tolerance:
            column = "yes"
        elif abs(cx - no_x) <= x_tolerance:
            column = "no"
        else:
            continue  # Not in either answer column

        # Check center region intensity (inner 50% of radius)
        inner_r = max(int(r * 0.5), 2)
        mask = np.zeros(cv_img_gray.shape, dtype=np.uint8)
        cv2.circle(mask, (cx, cy), inner_r, 255, -1)
        center_mean = cv2.mean(cv_img_gray, mask=mask)[0]

        is_filled = center_mean < 130

        results.append({
            "x": cx,
            "y": cy,
            "column": column,
            "isFilled": is_filled,
            "centerIntensity": round(center_mean, 1),
        })

    # Sort by y-position
    results.sort(key=lambda b: b["y"])

    # Group into rows by y-proximity
    rows = []
    if results:
        current_row = [results[0]]
        for b in results[1:]:
            if abs(b["y"] - current_row[0]["y"]) <= 20:
                current_row.append(b)
            else:
                rows.append(current_row)
                current_row = [b]
        rows.append(current_row)

    # Build answer pairs (limit to number of questions)
    pairs = []
    for row in rows[:num_questions]:
        yes_bubble = next((b for b in row if b["column"] == "yes"), None)
        no_bubble = next((b for b in row if b["column"] == "no"), None)
        pairs.append({"yes": yes_bubble, "no": no_bubble})

    return pairs


def extract_omr_questionnaire(cv_img_gray, raw_text):
    """
    Extract questions and their YES/NO answers from OMR form.
    """
    header = extract_header_fields(raw_text)
    questions = extract_questions(raw_text)
    num_questions = len(questions) if questions else 10

    yes_x, no_x, candidates = detect_answer_columns(cv_img_gray)
    if yes_x is None or no_x is None:
        return None

    pairs = analyze_bubbles(cv_img_gray, candidates, yes_x, no_x, num_questions)

    questionnaire = []
    for i, pair in enumerate(pairs):
        question_text = questions[i] if i < len(questions) else f"Question {i + 1}"

        yes_filled = pair["yes"]["isFilled"] if pair["yes"] else False
        no_filled = pair["no"]["isFilled"] if pair["no"] else False

        if yes_filled and not no_filled:
            answer = "YES"
        elif no_filled and not yes_filled:
            answer = "NO"
        elif yes_filled and no_filled:
            answer = "AMBIGUOUS"
        else:
            answer = "UNANSWERED"

        questionnaire.append({
            "questionNumber": i + 1,
            "question": question_text,
            "answer": answer,
            "yesMarked": yes_filled,
            "noMarked": no_filled,
        })

    return {
        "formType": "questionnaire",
        "header": header,
        "totalQuestions": len(questionnaire),
        "answered": sum(1 for q in questionnaire if q["answer"] in ("YES", "NO")),
        "unanswered": sum(1 for q in questionnaire if q["answer"] == "UNANSWERED"),
        "questions": questionnaire,
    }


def extract_header_fields(raw_text):
    """Extract header key-value pairs like Patient Name, ID, Age, etc."""
    header = {}
    lines = raw_text.split("\n")

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Stop at numbered questions
        if re.match(r"^\d+[\.\)]\s", line):
            break

        # Capture form title
        if "QUESTIONNAIRE" in line.upper() or "SURVEY" in line.upper():
            header["formTitle"] = line.strip()
            continue

        # Match key-value pairs
        kv_pairs = re.findall(r"([\w\s]+?):\s*([^\s:][^:]*?)(?=\s{2,}[\w\s]+:|$)", line)
        for key, value in kv_pairs:
            key = key.strip()
            value = value.strip()
            if key and value and len(key) < 30:
                header[key] = value

    return header


def extract_questions(raw_text):
    """Extract numbered question texts from OCR output."""
    questions = []
    lines = raw_text.split("\n")

    for line in lines:
        stripped = line.strip()
        match = re.match(r"^\d+[\.\)]\s*(.+)", stripped)
        if match:
            question_text = match.group(1).strip()
            # Clean trailing YES/NO and OMR artifacts (@, ©, O symbols)
            question_text = re.sub(
                r"\s*[@©®O]\s*(YES|NO|yes|no)\s*[@©®O]?\s*(YES|NO|yes|no)?\s*$",
                "",
                question_text,
            ).strip()
            question_text = re.sub(r"\s+(YES|NO)\s*$", "", question_text, flags=re.IGNORECASE).strip()
            if question_text and len(question_text) > 5:
                questions.append(question_text)

    return questions


# ---------------------------------------------------------------------------
# General OCR Functions
# ---------------------------------------------------------------------------

def preprocess_image(image_path: str):
    """Load and preprocess image. Returns (PIL Image, OpenCV grayscale)."""
    pil_img = Image.open(image_path).convert("L")
    cv_img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    return pil_img, cv_img


def extract_text(pil_img: Image.Image) -> tuple:
    """Extract text and confidence from image."""
    data = pytesseract.image_to_data(pil_img, output_type=pytesseract.Output.DICT)

    confidences = [c for c in data["conf"] if c != -1]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0

    raw_text = pytesseract.image_to_string(pil_img)

    return raw_text.strip(), round(avg_confidence, 2)


def structure_text(raw_text: str, page_type: str = None) -> dict:
    """Parse raw text into structured sections (for non-OMR pages)."""
    if not raw_text:
        return {"sections": []}

    lines = raw_text.split("\n")
    sections = []
    current_section = {"heading": None, "content": "", "fields": []}

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current_section["content"] or current_section["fields"]:
                sections.append(current_section)
                current_section = {"heading": None, "content": "", "fields": []}
            continue

        kv_match = re.match(r"^([A-Za-z][A-Za-z\s]{1,40}):\s*(.+)$", stripped)
        if kv_match:
            current_section["fields"].append({
                "label": kv_match.group(1).strip(),
                "value": kv_match.group(2).strip(),
            })
            continue

        if stripped.isupper() and len(stripped) > 2:
            if current_section["content"] or current_section["fields"]:
                sections.append(current_section)
            current_section = {"heading": stripped, "content": "", "fields": []}
            continue

        if stripped.endswith(":") and len(stripped) < 50:
            if current_section["content"] or current_section["fields"]:
                sections.append(current_section)
            current_section = {"heading": stripped.rstrip(":"), "content": "", "fields": []}
            continue

        if current_section["content"]:
            current_section["content"] += " " + stripped
        else:
            current_section["content"] = stripped

    if current_section["content"] or current_section["fields"]:
        sections.append(current_section)

    return {"sections": sections}


def has_omr_bubbles(raw_text: str) -> bool:
    """Heuristic: check if the page looks like an OMR questionnaire."""
    text_upper = raw_text.upper()
    has_yes_no = "YES" in text_upper and "NO" in text_upper
    has_numbered = bool(re.search(r"^\d+[\.\)]\s", raw_text, re.MULTILINE))
    has_questionnaire = "QUESTIONNAIRE" in text_upper or "SURVEY" in text_upper
    return has_yes_no and (has_numbered or has_questionnaire)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="OCR + OMR Processor for Digital Diary Pages")
    parser.add_argument("image_path", help="Path to the diary page image")
    parser.add_argument(
        "--page-type",
        choices=["test-status", "treatment-update", "symptoms", "notes"],
        default=None,
        help="Type of diary page (helps structure extraction)",
    )
    args = parser.parse_args()

    if not Path(args.image_path).exists():
        print(json.dumps({"error": f"Image file not found: {args.image_path}"}), file=sys.stderr)
        sys.exit(1)

    start_time = time.time()

    try:
        pil_img, cv_img = preprocess_image(args.image_path)
        raw_text, confidence = extract_text(pil_img)

        # Detect if this is an OMR questionnaire form
        omr_result = None
        if has_omr_bubbles(raw_text):
            omr_result = extract_omr_questionnaire(cv_img, raw_text)

        if omr_result:
            structured = omr_result
        else:
            structured = structure_text(raw_text, args.page_type)

        processing_time = round((time.time() - start_time) * 1000)

        result = {
            "rawText": raw_text,
            "confidence": confidence,
            "structured": structured,
            "metadata": {
                "processingTimeMs": processing_time,
                "imageWidth": pil_img.size[0],
                "imageHeight": pil_img.size[1],
                "omrDetected": omr_result is not None,
            },
        }

        print(json.dumps(result))
        sys.exit(0)

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
