"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.advancedAnalysisService = exports.AdvancedAnalysisService = void 0;
const advancedAnalysisRepository_1 = require("../repositories/advancedAnalysisRepository");
const AppError_1 = require("../utils/AppError");
/**
 * If submissionDateFrom or submissionDateTo is set, keep only patients who
 * have at least one scan whose scannedAt falls within [from, to] (inclusive).
 * If neither is set, returns the list unchanged.
 */
function applySubmissionDateFilter(patients, filter) {
    const { submissionDateFrom, submissionDateTo } = filter;
    if (!submissionDateFrom && !submissionDateTo)
        return patients;
    const from = submissionDateFrom ? new Date(submissionDateFrom) : null;
    // End of the "to" day (23:59:59.999)
    let to = null;
    if (submissionDateTo) {
        to = new Date(submissionDateTo);
        to.setHours(23, 59, 59, 999);
    }
    return patients.filter(({ scans }) => scans.some((s) => {
        if (!s.scannedAt)
            return false;
        const d = new Date(s.scannedAt);
        if (from && d < from)
            return false;
        if (to && d > to)
            return false;
        return true;
    }));
}
const repo = new advancedAnalysisRepository_1.AdvancedAnalysisRepository();
class AdvancedAnalysisService {
    async getPatients(doctorId, filter) {
        if (!doctorId) {
            throw new AppError_1.AppError(400, "Doctor ID is required");
        }
        const allPatients = await repo.findPatientsForDoctor(doctorId);
        // Pre-filter by submission date range: keep patients who have at least one
        // scan submitted within the requested window.
        const dateFilteredPatients = applySubmissionDateFilter(allPatients, filter);
        const rows = dateFilteredPatients.map(({ patient, scans }) => repo.mapToPatientAnalysisRow(patient, scans));
        const filtered = repo.applyFilters(rows, filter);
        const sorted = repo.applySorting(filtered, filter.sortBy);
        const total = sorted.length;
        const totalPages = Math.ceil(total / filter.limit) || 1;
        const offset = (filter.page - 1) * filter.limit;
        const patients = sorted.slice(offset, offset + filter.limit);
        return { patients, total, page: filter.page, totalPages };
    }
    async getCount(doctorId, filter) {
        if (!doctorId) {
            throw new AppError_1.AppError(400, "Doctor ID is required");
        }
        const allPatients = await repo.findPatientsForDoctor(doctorId);
        const dateFilteredPatients = applySubmissionDateFilter(allPatients, filter);
        const rows = dateFilteredPatients.map(({ patient, scans }) => repo.mapToPatientAnalysisRow(patient, scans));
        const filtered = repo.applyFilters(rows, filter);
        return filtered.length;
    }
}
exports.AdvancedAnalysisService = AdvancedAnalysisService;
exports.advancedAnalysisService = new AdvancedAnalysisService();
