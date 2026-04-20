"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeQuestionReports = exports.normalizeReportFiles = exports.normalizeReportFile = exports.deriveReportFileName = void 0;
const GENERATED_FILE_NAME_PATTERN = /^(?:\d{10,}|[a-z0-9]{8,})(?:[-_][a-z0-9]+)*\.[a-z0-9]+$/i;
const SUFFIXED_UPLOAD_NAME_PATTERN = /^(.*)-\d{13}-[a-z0-9]+(\.[a-z0-9]+)$/i;
function decodePathSegment(value) {
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
}
function extractUrlFromStoredFile(file) {
    if (typeof file === "string") {
        return file;
    }
    if (!file || typeof file !== "object") {
        return null;
    }
    return typeof file.url === "string" && file.url.trim() ? file.url : null;
}
function extractStoredName(file) {
    const candidates = [file.name, file.fileName, file.originalName];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }
    return null;
}
function deriveReportFileName(url, fallback = "Uploaded file") {
    const normalizeDerivedName = (rawName) => {
        const suffixedMatch = rawName.match(SUFFIXED_UPLOAD_NAME_PATTERN);
        if (suffixedMatch && suffixedMatch[1]) {
            return `${suffixedMatch[1]}${suffixedMatch[2]}`;
        }
        if (GENERATED_FILE_NAME_PATTERN.test(rawName)) {
            return fallback;
        }
        return rawName;
    };
    try {
        const parsed = new URL(url);
        const rawName = decodePathSegment(parsed.pathname.split("/").pop() || "").trim();
        if (!rawName) {
            return fallback;
        }
        return normalizeDerivedName(rawName);
    }
    catch {
        const sanitized = decodePathSegment(url.split("?")[0].split("#")[0].split("/").pop() || "").trim();
        if (!sanitized) {
            return fallback;
        }
        return normalizeDerivedName(sanitized);
    }
}
exports.deriveReportFileName = deriveReportFileName;
function normalizeReportFile(file, fallback = "Uploaded file") {
    const url = extractUrlFromStoredFile(file);
    if (!url) {
        return null;
    }
    if (typeof file !== "string") {
        const storedName = extractStoredName(file);
        if (storedName) {
            return { url, name: storedName };
        }
    }
    return { url, name: deriveReportFileName(url, fallback) };
}
exports.normalizeReportFile = normalizeReportFile;
function normalizeReportFiles(files, fallback = "Uploaded file") {
    if (!Array.isArray(files)) {
        return [];
    }
    return files
        .map((file) => normalizeReportFile(file, fallback))
        .filter((file) => file !== null);
}
exports.normalizeReportFiles = normalizeReportFiles;
function normalizeQuestionReports(reports, fallback = "Uploaded file") {
    if (!reports || typeof reports !== "object") {
        return {};
    }
    return Object.entries(reports).reduce((acc, [questionId, files]) => {
        const normalized = normalizeReportFiles(files, fallback);
        if (normalized.length > 0) {
            acc[questionId] = normalized;
        }
        return acc;
    }, {});
}
exports.normalizeQuestionReports = normalizeQuestionReports;
