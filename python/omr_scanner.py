#!/usr/bin/env python3
"""
OMR (Optical Mark Recognition) Bubble Scanner

Reads a photograph of a diary page with yes/no bubble questions
and detects which bubbles are filled.

Usage:
  python3 omr_scanner.py <image_path> <page_number|auto>

  - page_number: integer page number to load the correct bubble template
  - auto: uses OCR to detect the page number from the image

Output:
    JSON to stdout with scan results.
    Diagnostic logs to stderr.
"""

import sys
import os
import json
import time

try:
    import numpy as np
    import cv2
except ImportError as _import_err:
    result = {
        "success": False,
        "error": "DEPENDENCY_MISSING",
        "message": (
            f"Required Python package missing: {_import_err}. "
            "Run on the server: pip3 install -r python/requirements.txt"
        )
    }
    print(json.dumps(result))
    sys.exit(1)

# pytesseract is optional — only needed for auto-detect mode
pytesseract = None
try:
    import pytesseract as _pytesseract
    pytesseract = _pytesseract
except ImportError:
    pass


def log(msg):
    """Log diagnostic messages to stderr (not captured as output)."""
    print(f"[OMR] {msg}", file=sys.stderr)


def get_script_dir():
    return os.path.dirname(os.path.abspath(__file__))


def load_template(page_number):
    """Load a bubble coordinate template JSON by page number."""
    script_dir = get_script_dir()
    templates_dir = os.path.join(script_dir, "templates")

    # Look for a template file matching the page number
    for fname in os.listdir(templates_dir):
        if not fname.endswith(".json") or fname == "template_index.json":
            continue
        fpath = os.path.join(templates_dir, fname)
        with open(fpath, "r") as f:
            data = json.load(f)
        if data.get("pageNumber") == page_number:
            return data, None

    return None, f"No template found for page number {page_number}"


def detect_page_number(image):
    """
    Detect the page number from the scanned image using OCR.
    Reads the page number region or top portion of the image.
    """
    if pytesseract is None:
        return None, "pytesseract is not installed. Run: pip3 install pytesseract (and install Tesseract OCR engine)"

    # Load template index for OCR configuration
    script_dir = get_script_dir()
    index_path = os.path.join(script_dir, "templates", "template_index.json")

    img_h, img_w = image.shape[:2]
    scan_region = None
    expected_w = img_w
    expected_h = img_h

    if os.path.exists(index_path):
        with open(index_path, "r") as f:
            template_index = json.load(f)
        scan_region = template_index.get("ocrScanRegion")
        expected_w = template_index.get("imageExpectedWidth", img_w)
        expected_h = template_index.get("imageExpectedHeight", img_h)

    scale_x = img_w / expected_w
    scale_y = img_h / expected_h

    if scan_region:
        x = int(scan_region["x"] * scale_x)
        y = int(scan_region["y"] * scale_y)
        w = int(scan_region["width"] * scale_x)
        h = int(scan_region["height"] * scale_y)
        x = max(0, x)
        y = max(0, y)
        w = min(w, img_w - x)
        h = min(h, img_h - y)
        roi = image[y:y+h, x:x+w]
    else:
        # Default: top 15% of the image
        top_h = int(img_h * 0.15)
        roi = image[0:top_h, 0:img_w]

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY) if len(roi.shape) == 3 else roi
    gray = cv2.convertScaleAbs(gray, alpha=1.5, beta=0)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    detected_text = pytesseract.image_to_string(binary, config="--psm 6").strip()
    log(f"OCR detected text: '{detected_text}'")

    if not detected_text:
        return None, "OCR could not detect any text from the page"

    # Try to match against template index mappings
    if os.path.exists(index_path):
        with open(index_path, "r") as f:
            template_index = json.load(f)

        detected_lower = detected_text.lower()
        mappings = template_index.get("mappings", [])
        best_match = None
        best_score = 0

        for mapping in mappings:
            keywords = [k.lower() for k in mapping.get("keywords", [])]
            score = sum(1 for kw in keywords if kw in detected_lower)
            if score > best_score:
                best_score = score
                best_match = mapping

        if best_match and best_score > 0:
            page_num = best_match.get("pageNumber")
            log(f"Matched page number: {page_num} (score={best_score})")
            return page_num, None

    return None, f"Could not determine page number from text: '{detected_text}'"


def preprocess_image(image, expected_width, expected_height):
    """
    Preprocess the image for bubble detection.
    Returns the thresholded binary image and scale factors.
    """
    height, width = image.shape[:2]
    log(f"Original image size: {width}x{height}")

    scale_x = width / expected_width
    scale_y = height / expected_height
    log(f"Scale factors: x={scale_x:.3f}, y={scale_y:.3f}")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        11, 2
    )

    return thresh, scale_x, scale_y


def analyze_bubble(thresh_image, center_x, center_y, radius, scale_x, scale_y):
    """
    Analyze a single bubble region to determine its fill ratio.
    """
    cx = int(center_x * scale_x)
    cy = int(center_y * scale_y)
    r = int(radius * max(scale_x, scale_y))

    img_h, img_w = thresh_image.shape
    x1 = max(0, cx - r)
    y1 = max(0, cy - r)
    x2 = min(img_w, cx + r)
    y2 = min(img_h, cy + r)

    if x2 <= x1 or y2 <= y1:
        log(f"  Bubble region out of bounds: ({cx}, {cy}) r={r}")
        return 0.0

    roi = thresh_image[y1:y2, x1:x2]

    mask = np.zeros(roi.shape, dtype=np.uint8)
    mask_cx = cx - x1
    mask_cy = cy - y1
    cv2.circle(mask, (mask_cx, mask_cy), r, 255, -1)

    masked = cv2.bitwise_and(roi, mask)
    filled_pixels = cv2.countNonZero(masked)
    total_pixels = cv2.countNonZero(mask)

    if total_pixels == 0:
        return 0.0

    return filled_pixels / total_pixels


def process_bubbles(thresh_image, bubble_coordinates, scale_x, scale_y, confidence_threshold, min_fill_ratio):
    """
    Process all bubble coordinates and determine answers.
    bubble_coordinates: { "q1": { "yes": {x,y,r}, "no": {x,y,r} }, ... }
    """
    results = {}

    for qid, bubbles in bubble_coordinates.items():
        yes_bubble = bubbles["yes"]
        no_bubble = bubbles["no"]

        yes_fill = analyze_bubble(
            thresh_image,
            yes_bubble["x"], yes_bubble["y"], yes_bubble["r"],
            scale_x, scale_y
        )

        no_fill = analyze_bubble(
            thresh_image,
            no_bubble["x"], no_bubble["y"], no_bubble["r"],
            scale_x, scale_y
        )

        log(f"  {qid}: yes_fill={yes_fill:.3f}, no_fill={no_fill:.3f}")

        diff = abs(yes_fill - no_fill)

        if yes_fill >= min_fill_ratio and yes_fill > no_fill and diff >= confidence_threshold:
            answer = "yes"
            confidence = min(diff / 0.5, 1.0)
        elif no_fill >= min_fill_ratio and no_fill > yes_fill and diff >= confidence_threshold:
            answer = "no"
            confidence = min(diff / 0.5, 1.0)
        else:
            answer = "uncertain"
            confidence = diff

        results[qid] = {
            "answer": answer,
            "confidence": round(confidence, 3),
            "yesScore": round(yes_fill, 3),
            "noScore": round(no_fill, 3),
        }

    return results


def main():
    start_time = time.time()

    if len(sys.argv) < 3:
        result = {
            "success": False,
            "error": "INVALID_ARGS",
            "message": "Usage: python3 omr_scanner.py <image_path> <page_number|auto>"
        }
        print(json.dumps(result))
        sys.exit(1)

    image_path = sys.argv[1]
    page_arg = sys.argv[2]

    log(f"Processing image: {image_path}")
    log(f"Page argument: {page_arg}")

    # Load image
    if not os.path.exists(image_path):
        result = {
            "success": False,
            "error": "IMAGE_NOT_FOUND",
            "message": f"Image file not found: {image_path}"
        }
        print(json.dumps(result))
        sys.exit(1)

    image = cv2.imread(image_path)
    if image is None:
        result = {
            "success": False,
            "error": "IMAGE_NOT_READABLE",
            "message": f"Could not read image file: {image_path}"
        }
        print(json.dumps(result))
        sys.exit(1)

    log("Image loaded successfully")

    # Determine page number
    auto_detected = False
    if page_arg == "auto":
        page_number, error = detect_page_number(image)
        if error:
            result = {
                "success": False,
                "error": "AUTO_DETECT_FAILED",
                "message": error
            }
            print(json.dumps(result))
            sys.exit(1)
        auto_detected = True
        log(f"Auto-detected page number: {page_number}")
    else:
        try:
            page_number = int(page_arg)
        except ValueError:
            result = {
                "success": False,
                "error": "INVALID_ARGS",
                "message": f"page_number must be an integer or 'auto', got: {page_arg}"
            }
            print(json.dumps(result))
            sys.exit(1)

    # Load bubble coordinate template for this page
    template, error = load_template(page_number)
    if error:
        result = {
            "success": False,
            "error": "TEMPLATE_NOT_FOUND",
            "message": error
        }
        print(json.dumps(result))
        sys.exit(1)

    # Preprocess image
    expected_w = template.get("imageExpectedWidth", image.shape[1])
    expected_h = template.get("imageExpectedHeight", image.shape[0])
    thresh, scale_x, scale_y = preprocess_image(image, expected_w, expected_h)

    # Process bubble coordinates
    bubble_coords = template.get("bubbleCoordinates", {})
    confidence_threshold = template.get("confidenceThreshold", 0.15)
    min_fill_ratio = template.get("minFillRatio", 0.3)

    log(f"Processing {len(bubble_coords)} questions (threshold={confidence_threshold}, minFill={min_fill_ratio})")
    results = process_bubbles(thresh, bubble_coords, scale_x, scale_y, confidence_threshold, min_fill_ratio)

    # Metadata
    total_questions = len(bubble_coords)
    answered_confidently = sum(1 for r in results.values() if r["answer"] != "uncertain")
    uncertain_count = total_questions - answered_confidently
    processing_time_ms = int((time.time() - start_time) * 1000)

    log(f"Done: {answered_confidently}/{total_questions} answered confidently in {processing_time_ms}ms")

    output = {
        "success": True,
        "pageNumber": page_number,
        "autoDetected": auto_detected,
        "results": results,
        "metadata": {
            "totalQuestions": total_questions,
            "answeredConfidently": answered_confidently,
            "uncertainCount": uncertain_count,
            "alignmentQuality": "direct",
            "processingTimeMs": processing_time_ms,
        }
    }

    print(json.dumps(output))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"Unexpected error: {e}")
        result = {
            "success": False,
            "error": "PROCESSING_ERROR",
            "message": str(e)
        }
        print(json.dumps(result))
        sys.exit(1)
