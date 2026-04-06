import { Op } from "sequelize";
import { Diary } from "../models/Diary";
import { Patient } from "../models/Patient";
import { AppError } from "../utils/AppError";
import { DIARY_STATUS, normalizeDiaryStatus } from "../utils/diaryStatus";

export const DIARY_ACCESS_REQUIRED_MESSAGE =
  "Diary not accessible. Approval required.";

/**
 * Loads the patient's currently linked diary and enforces that it is approved.
 * This is the single approval gate reused across patient and doctor diary APIs.
 */
export async function assertApprovedDiaryAccess(patientId: string) {
  const patient = await Patient.findByPk(patientId, {
    attributes: ["id", "diaryId", "doctorId"],
  });

  if (!patient) {
    throw new AppError(404, "Patient not found");
  }

  if (!patient.diaryId) {
    console.info(`[DIARY_ACCESS] denied patient=${patientId} reason=no_diary`);
    throw new AppError(403, DIARY_ACCESS_REQUIRED_MESSAGE);
  }

  const diary = await Diary.findByPk(patient.diaryId, {
    attributes: ["id", "status", "patientId", "doctorId"],
  });
  const normalizedStatus = normalizeDiaryStatus(diary?.status);

  console.info(
    `[DIARY_ACCESS] patient=${patientId} diary=${patient.diaryId} status=${diary?.status ?? "MISSING"} normalized=${normalizedStatus}`
  );

  if (!diary || normalizedStatus !== DIARY_STATUS.APPROVED) {
    throw new AppError(403, DIARY_ACCESS_REQUIRED_MESSAGE);
  }

  return { patient, diary };
}

/**
 * Filters a patient list down to only patients whose currently linked diary is approved.
 * Rejected/unlinked diaries are excluded so they disappear consistently across dashboards.
 */
export async function filterPatientsWithApprovedDiaries(
  patientIds: string[]
): Promise<Set<string>> {
  const uniquePatientIds = [...new Set(patientIds.filter(Boolean))];
  if (uniquePatientIds.length === 0) {
    return new Set<string>();
  }

  const patients = (await Patient.findAll({
    where: { id: { [Op.in]: uniquePatientIds } },
    attributes: ["id", "diaryId"],
    raw: true,
  })) as Array<{ id: string; diaryId: string | null }>;

  const diaryIds = patients
    .map((patient) => patient.diaryId)
    .filter((diaryId): diaryId is string => Boolean(diaryId));

  if (diaryIds.length === 0) {
    return new Set<string>();
  }

  const diaries = (await Diary.findAll({
    where: { id: { [Op.in]: diaryIds } },
    attributes: ["id", "status"],
    raw: true,
  })) as Array<{ id: string; status: string }>;

  const approvedDiaryIds = new Set(
    diaries
      .filter((diary) => normalizeDiaryStatus(diary.status) === DIARY_STATUS.APPROVED)
      .map((diary) => diary.id)
  );

  return new Set(
    patients
      .filter((patient) => patient.diaryId && approvedDiaryIds.has(patient.diaryId))
      .map((patient) => patient.id)
  );
}
