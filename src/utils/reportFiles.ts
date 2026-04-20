export interface ReportFile {
  url: string;
  name: string;
}

export type StoredReportFile =
  | string
  | {
      url?: string | null;
      name?: string | null;
      fileName?: string | null;
      originalName?: string | null;
    };

const GENERATED_FILE_NAME_PATTERN =
  /^(?:\d{10,}|[a-z0-9]{8,})(?:[-_][a-z0-9]+)*\.[a-z0-9]+$/i;
const SUFFIXED_UPLOAD_NAME_PATTERN = /^(.*)-\d{13}-[a-z0-9]+(\.[a-z0-9]+)$/i;

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractUrlFromStoredFile(file: StoredReportFile): string | null {
  if (typeof file === "string") {
    return file;
  }

  if (!file || typeof file !== "object") {
    return null;
  }

  return typeof file.url === "string" && file.url.trim() ? file.url : null;
}

function extractStoredName(file: Exclude<StoredReportFile, string>): string | null {
  const candidates = [file.name, file.fileName, file.originalName];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

export function deriveReportFileName(url: string, fallback = "Uploaded file"): string {
  const normalizeDerivedName = (rawName: string): string => {
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
  } catch {
    const sanitized = decodePathSegment(url.split("?")[0].split("#")[0].split("/").pop() || "").trim();
    if (!sanitized) {
      return fallback;
    }
    return normalizeDerivedName(sanitized);
  }
}

export function normalizeReportFile(file: StoredReportFile, fallback = "Uploaded file"): ReportFile | null {
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

export function normalizeReportFiles(
  files: StoredReportFile[] | null | undefined,
  fallback = "Uploaded file"
): ReportFile[] {
  if (!Array.isArray(files)) {
    return [];
  }

  return files
    .map((file) => normalizeReportFile(file, fallback))
    .filter((file): file is ReportFile => file !== null);
}

export function normalizeQuestionReports(
  reports: Record<string, Array<StoredReportFile>> | null | undefined,
  fallback = "Uploaded file"
): Record<string, ReportFile[]> {
  if (!reports || typeof reports !== "object") {
    return {};
  }

  return Object.entries(reports).reduce<Record<string, ReportFile[]>>((acc, [questionId, files]) => {
    const normalized = normalizeReportFiles(files, fallback);
    if (normalized.length > 0) {
      acc[questionId] = normalized;
    }
    return acc;
  }, {});
}
