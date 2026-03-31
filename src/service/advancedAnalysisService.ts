import { AdvancedAnalysisRepository } from "../repositories/advancedAnalysisRepository";
import { AdvancedAnalysisFilter, PatientAnalysisRow } from "./advancedAnalysisTypes";
import { AppError } from "../utils/AppError";

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
    const rows = allPatients.map(({ patient, scans }) =>
      repo.mapToPatientAnalysisRow(patient, scans)
    );
    const filtered = repo.applyFilters(rows, filter);
    const sorted = repo.applySorting(filtered, filter.sortBy);

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
    const rows = allPatients.map(({ patient, scans }) =>
      repo.mapToPatientAnalysisRow(patient, scans)
    );
    const filtered = repo.applyFilters(rows, filter);
    return filtered.length;
  }
}

export const advancedAnalysisService = new AdvancedAnalysisService();
