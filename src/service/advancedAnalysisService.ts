import { AdvancedAnalysisRepository } from "../repositories/advancedAnalysisRepository";
import type { AdvancedAnalysisFilter, PatientAnalysisRow } from "./advancedAnalysisTypes";
import { BubbleScanResult } from "../models/BubbleScanResult";
import { Patient } from "../models/Patient";
import { AppError } from "../utils/AppError";

interface PatientWithScans { patient: Patient; scans: BubbleScanResult[] }

/**
 * If submissionDateFrom or submissionDateTo is set, keep only patients who
 * have at least one scan whose scannedAt falls within [from, to] (inclusive).
 * If neither is set, returns the list unchanged.
 */
function applySubmissionDateFilter(
  patients: PatientWithScans[],
  filter: AdvancedAnalysisFilter
): PatientWithScans[] {
  const { submissionDateFrom, submissionDateTo } = filter;
  if (!submissionDateFrom && !submissionDateTo) return patients;

  const from = submissionDateFrom ? new Date(submissionDateFrom) : null;
  // End of the "to" day (23:59:59.999)
  let to: Date | null = null;
  if (submissionDateTo) {
    to = new Date(submissionDateTo);
    to.setHours(23, 59, 59, 999);
  }

  return patients.filter(({ scans }) =>
    scans.some((s) => {
      if (!s.scannedAt) return false;
      const d = new Date(s.scannedAt);
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    })
  );
}

/**
 * Client-side text search across name and UHID fields.
 * Returns the list unchanged if query is empty.
 */
function applySearchFilter(
  rows: PatientAnalysisRow[],
  query: string | undefined
): PatientAnalysisRow[] {
  if (!query || query.trim() === "") return rows;
  const q = query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (r.name ?? "").toLowerCase().includes(q) ||
      (r.uhid ?? "").toLowerCase().includes(q) ||
      (r.patientId ?? "").toLowerCase().includes(q)
  );
}

const repo = new AdvancedAnalysisRepository();

export class AdvancedAnalysisService {
  async getPatients(
    doctorId: string,
    filter: AdvancedAnalysisFilter
  ): Promise<{
    patients: PatientAnalysisRow[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    if (!doctorId) {
      throw new AppError(400, "Doctor ID is required");
    }

    const allPatients = await repo.findPatientsForDoctor(doctorId);

    // Pre-filter by submission date range: keep patients who have at least one
    // scan submitted within the requested window.
    const dateFilteredPatients = applySubmissionDateFilter(allPatients, filter);

    const rows = dateFilteredPatients.map(({ patient, scans }) =>
      repo.mapToPatientAnalysisRow(patient, scans)
    );
    const filtered = repo.applyFilters(rows, filter);
    const searched = applySearchFilter(filtered, filter.search);
    const sorted = repo.applySorting(searched, filter.sortBy);

    const total = sorted.length;
    const totalPages = Math.ceil(total / filter.limit) || 1;
    const offset = (filter.page - 1) * filter.limit;
    const patients = sorted.slice(offset, offset + filter.limit);

    return { patients, total, page: filter.page, totalPages };
  }

  async getCount(doctorId: string, filter: AdvancedAnalysisFilter): Promise<number> {
    if (!doctorId) {
      throw new AppError(400, "Doctor ID is required");
    }

    const allPatients = await repo.findPatientsForDoctor(doctorId);
    const dateFilteredPatients = applySubmissionDateFilter(allPatients, filter);
    const rows = dateFilteredPatients.map(({ patient, scans }) =>
      repo.mapToPatientAnalysisRow(patient, scans)
    );
    const filtered = repo.applyFilters(rows, filter);
    return applySearchFilter(filtered, filter.search).length;
  }
}

export const advancedAnalysisService = new AdvancedAnalysisService();
