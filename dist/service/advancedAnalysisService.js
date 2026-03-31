"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.advancedAnalysisService = exports.AdvancedAnalysisService = void 0;
const advancedAnalysisRepository_1 = require("../repositories/advancedAnalysisRepository");
const AppError_1 = require("../utils/AppError");
const repo = new advancedAnalysisRepository_1.AdvancedAnalysisRepository();
class AdvancedAnalysisService {
    async getPatients(doctorId, filter) {
        if (!doctorId) {
            throw new AppError_1.AppError(400, "Doctor ID is required");
        }
        const allPatients = await repo.findPatientsForDoctor(doctorId);
        const rows = allPatients.map(({ patient, scans }) => repo.mapToPatientAnalysisRow(patient, scans));
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
        const rows = allPatients.map(({ patient, scans }) => repo.mapToPatientAnalysisRow(patient, scans));
        const filtered = repo.applyFilters(rows, filter);
        return filtered.length;
    }
}
exports.AdvancedAnalysisService = AdvancedAnalysisService;
exports.advancedAnalysisService = new AdvancedAnalysisService();
