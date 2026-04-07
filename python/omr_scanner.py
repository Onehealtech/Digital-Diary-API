#!/usr/bin/env python3
"""
Image Preprocessor for CANTrac Diary Pages.

Handles:
- Fiducial marker detection (4 black corner squares)
- Perspective correction → flat, normalized image
- Provides clean image for AI text extraction

No bubble detection — all reading is done by the AI model.
"""

import sys
import os
import json
import time
import math
import numpy as np

try:
    import cv2
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "DEPENDENCY_MISSING",
        "message": "opencv-python-headless not installed. Run: pip install opencv-python-headless numpy"
    }))
    sys.exit(1)


def log(msg: str):
    print(f"[PREPROCESS] {msg}", file=sys.stderr)


# Normalized output size (A4 at ~200 DPI)
NORM_W = 1654
NORM_H = 2339


def find_fiducial_markers(image: np.ndarray) -> list:
    """
    Detect the 4 black square corner markers on the CANTrac diary page.
    Returns sorted corners: [top-left, top-right, bottom-right, bottom-left]
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 60, 255, cv2.THRESH_BINARY_INV)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    img_h, img_w = image.shape[:2]
    img_area = img_h * img_w
    min_area = img_area * 0.0003
    max_area = img_area * 0.008

    candidates = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.04 * peri, True)
        if len(approx) < 4 or len(approx) > 6:
            continue
        x, y, w, h = cv2.boundingRect(approx)
        aspect = w / h if h > 0 else 0
        if 0.6 < aspect < 1.4:
            cx = x + w // 2
            cy = y + h // 2
            candidates.append((cx, cy, area))

    if len(candidates) < 4:
        log(f"Found only {len(candidates)} fiducial candidates (need 4)")
        return []

    # Convert to simple (x, y) points
    pts = [(c[0], c[1]) for c in candidates]

    # Find the 4 extreme corners using sum and difference of coordinates
    # top-left has smallest x+y, bottom-right has largest x+y
    # top-right has largest x-y, bottom-left has smallest x-y
    top_left = min(pts, key=lambda p: p[0] + p[1])
    bottom_right = max(pts, key=lambda p: p[0] + p[1])
    top_right = max(pts, key=lambda p: p[0] - p[1])
    bottom_left = min(pts, key=lambda p: p[0] - p[1])

    corners = [top_left, top_right, bottom_right, bottom_left]

    # Validate: all 4 corners must be distinct (at least 50px apart)
    for i in range(4):
        for j in range(i + 1, 4):
            dist = math.sqrt((corners[i][0] - corners[j][0]) ** 2 + (corners[i][1] - corners[j][1]) ** 2)
            if dist < 50:
                log(f"Corners {i} and {j} too close ({dist:.0f}px) — fiducial detection unreliable")
                return []

    log(f"Fiducial corners found: TL={corners[0]}, TR={corners[1]}, BR={corners[2]}, BL={corners[3]}")
    return corners


def perspective_correct(image: np.ndarray, corners: list) -> np.ndarray:
    src = np.float32(corners)
    dst = np.float32([[0, 0], [NORM_W, 0], [NORM_W, NORM_H], [0, NORM_H]])
    M = cv2.getPerspectiveTransform(src, dst)
    warped = cv2.warpPerspective(image, M, (NORM_W, NORM_H))
    log(f"Perspective corrected to {NORM_W}x{NORM_H}")
    return warped


def fallback_normalize(image: np.ndarray) -> np.ndarray:
    h, w = image.shape[:2]
    scale = min(NORM_W / w, NORM_H / h)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    canvas = np.ones((NORM_H, NORM_W, 3), dtype=np.uint8) * 255
    y_off = (NORM_H - new_h) // 2
    x_off = (NORM_W - new_w) // 2
    canvas[y_off:y_off + new_h, x_off:x_off + new_w] = resized
    log(f"Fallback normalize: {w}x{h} → {NORM_W}x{NORM_H}")
    return canvas


def enhance_image(normalized: np.ndarray) -> np.ndarray:
    """Enhance contrast and sharpness for better AI reading."""
    # CLAHE on L channel for better contrast
    lab = cv2.cvtColor(normalized, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    enhanced = cv2.merge([l, a, b])
    enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

    # Mild sharpening
    kernel = np.array([[0, -0.5, 0], [-0.5, 3, -0.5], [0, -0.5, 0]])
    enhanced = cv2.filter2D(enhanced, -1, kernel)

    return enhanced


def get_normalized_image(image: np.ndarray) -> tuple:
    """
    Normalize image: detect fiducials → perspective correct → enhance.
    Returns (normalized_image, alignment_method).
    """
    corners = find_fiducial_markers(image)
    if len(corners) == 4:
        normalized = perspective_correct(image, corners)
        alignment = "fiducial"
    else:
        normalized = fallback_normalize(image)
        alignment = "fallback"
        log("Using fallback normalization (fiducial markers not found)")

    enhanced = enhance_image(normalized)
    return enhanced, alignment
