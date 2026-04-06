"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterPatientsWithApprovedDiaries = exports.assertApprovedDiaryAccess = exports.DIARY_ACCESS_REQUIRED_MESSAGE = void 0;
const sequelize_1 = require("sequelize");
const Diary_1 = require("../models/Diary");
const Patient_1 = require("../models/Patient");
const AppError_1 = require("../utils/AppError");
const diaryStatus_1 = require("../utils/diaryStatus");
exports.DIARY_ACCESS_REQUIRED_MESSAGE = "Diary not accessible. Approval required.";
/**
 * Loads the patient's currently linked diary and enforces that it is approved.
 * This is the single approval gate reused across patient and doctor diary APIs.
 */
async function assertApprovedDiaryAccess(patientId) {
    const patient = await Patient_1.Patient.findByPk(patientId, {
        attributes: ["id", "diaryId", "doctorId"],
    });
    if (!patient) {
        throw new AppError_1.AppError(404, "Patient not found");
    }
    if (!patient.diaryId) {
        console.info(`[DIARY_ACCESS] denied patient=${patientId} reason=no_diary`);
        throw new AppError_1.AppError(403, exports.DIARY_ACCESS_REQUIRED_MESSAGE);
    }
    const diary = await Diary_1.Diary.findByPk(patient.diaryId, {
        attributes: ["id", "status", "patientId", "doctorId"],
    });
    const normalizedStatus = (0, diaryStatus_1.normalizeDiaryStatus)(diary?.status);
    console.info(`[DIARY_ACCESS] patient=${patientId} diary=${patient.diaryId} status=${diary?.status ?? "MISSING"} normalized=${normalizedStatus}`);
    if (!diary || normalizedStatus !== diaryStatus_1.DIARY_STATUS.APPROVED) {
        throw new AppError_1.AppError(403, exports.DIARY_ACCESS_REQUIRED_MESSAGE);
    }
    return { patient, diary };
}
exports.assertApprovedDiaryAccess = assertApprovedDiaryAccess;
/**
 * Filters a patient list down to only patients whose currently linked diary is approved.
 * Rejected/unlinked diaries are excluded so they disappear consistently across dashboards.
 */
async function filterPatientsWithApprovedDiaries(patientIds) {
    const uniquePatientIds = [...new Set(patientIds.filter(Boolean))];
    if (uniquePatientIds.length === 0) {
        return new Set();
    }
    const patients = (await Patient_1.Patient.findAll({
        where: { id: { [sequelize_1.Op.in]: uniquePatientIds } },
        attributes: ["id", "diaryId"],
        raw: true,
    }));
    const diaryIds = patients
        .map((patient) => patient.diaryId)
        .filter((diaryId) => Boolean(diaryId));
    if (diaryIds.length === 0) {
        return new Set();
    }
    const diaries = (await Diary_1.Diary.findAll({
        where: { id: { [sequelize_1.Op.in]: diaryIds } },
        attributes: ["id", "status"],
        raw: true,
    }));
    const approvedDiaryIds = new Set(diaries
        .filter((diary) => (0, diaryStatus_1.normalizeDiaryStatus)(diary.status) === diaryStatus_1.DIARY_STATUS.APPROVED)
        .map((diary) => diary.id));
    return new Set(patients
        .filter((patient) => patient.diaryId && approvedDiaryIds.has(patient.diaryId))
        .map((patient) => patient.id));
}
exports.filterPatientsWithApprovedDiaries = filterPatientsWithApprovedDiaries;
