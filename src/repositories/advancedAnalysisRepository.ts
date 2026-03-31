import { Op } from "sequelize";
import { AppUser } from "../models/Appuser";
import { Patient } from "../models/Patient";
import { BubbleScanResult } from "../models/BubbleScanResult";
import {
  AdvancedAnalysisFilter,
  InvestigationData,
  INVESTIGATIONS,
  PatientAnalysisRow,
} from "../service/advancedAnalysisTypes";

// -----------------------------------------------------------------------
// Internal raw types for DB query results
// -----------------------------------------------------------------------

interface RawScanResults {
  [key: string]: unknown;
}

interface PatientWithScans {
  patient: Patient;
  scans: BubbleScanResult[];
}

// -----------------------------------------------------------------------
// Helpers to safely extract values from JSONB scanResults
// -----------------------------------------------------------------------

function getBool(obj: RawScanResults, key: string): boolean {
  const val = obj[key];
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val === "true" || val === "1" || val === "yes";
  if (typeof val === "number") return val === 1;
  return false;
}

function getString(obj: RawScanResults, key: string): string | null {
  const val = obj[key];
  if (typeof val === "string" && val.trim() !== "") return val.trim();
  return null;
}

function toIsoDate(val: unknown): string | null {
  if (typeof val === "string" && val.trim() !== "") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  if (val instanceof Date) return val.toISOString();
  return null;
}

function safeScanResults(scan: BubbleScanResult): RawScanResults {
  const sr = scan.scanResults;
  if (sr && typeof sr === "object" && !Array.isArray(sr)) {
    return sr as RawScanResults;
  }
  return {};
}

// -----------------------------------------------------------------------
// Appointment status mapper
// -----------------------------------------------------------------------

function parseAppointmentStatus(
  val: unknown
): "NONE" | "SCHEDULED" | "COMPLETED" | "MISSED" | "CANCELLED" {
  const s = typeof val === "string" ? val.toUpperCase() : "";
  if (s === "SCHEDULED") return "SCHEDULED";
  if (s === "COMPLETED") return "COMPLETED";
  if (s === "MISSED") return "MISSED";
  if (s === "CANCELLED") return "CANCELLED";
  return "NONE";
}

// -----------------------------------------------------------------------
// Per-investigation extractor
// Pages 7-28 contain investigation detail pages. Each investigation key
// maps to a page range or a field name inside scanResults JSONB.
// We look for matching keys in all scan pages 7-28.
// -----------------------------------------------------------------------

const INV_KEY_TO_PAGE_FIELD_PREFIX: Record<string, string> = {
  mammogram:        "mammogram",
  usgBreast:        "usgBreast",
  biopsyBreast:     "biopsyBreast",
  fnacAxillary:     "fnacAxillary",
  petCt:            "petCt",
  mriBreasts:       "mriBreasts",
  geneticTesting:   "geneticTesting",
  mugaScan:         "mugaScan",
  echocardiography: "echocardiography",
  boneDexa:         "boneDexa",
  ecg:              "ecg",
  chestXray:        "chestXray",
  bloodTests:       "bloodTests",
  otherTests:       "otherTests",
};

function buildInvestigationData(
  key: string,
  orderedPageScans: RawScanResults[],
  detailPageScans: RawScanResults[]
): InvestigationData {
  // Check ordered flag from pages 5-6
  let ordered = false;
  const fieldPrefix = INV_KEY_TO_PAGE_FIELD_PREFIX[key] ?? key;

  for (const sr of orderedPageScans) {
    if (getBool(sr, key) || getBool(sr, fieldPrefix) || getBool(sr, `${fieldPrefix}Ordered`)) {
      ordered = true;
      break;
    }
  }

  // Extract detail data from pages 7-28
  let appointmentStatus: InvestigationData["appointmentStatus"] = "NONE";
  let appointmentDate: string | null = null;
  let testDone = false;
  let reportCollected = false;
  let problemFlagged = false;

  for (const sr of detailPageScans) {
    // Look for keys like mammogramAppointmentStatus, mammogramDone, etc.
    const apptStatusKey = `${fieldPrefix}AppointmentStatus`;
    const apptDateKey   = `${fieldPrefix}AppointmentDate`;
    const doneKey       = `${fieldPrefix}Done`;
    const reportKey     = `${fieldPrefix}ReportCollected`;
    const flagKey       = `${fieldPrefix}ProblemFlagged`;

    if (sr[apptStatusKey] !== undefined) {
      appointmentStatus = parseAppointmentStatus(sr[apptStatusKey]);
      if (ordered) { /* ordered remains from above */ }
    }
    if (sr[apptDateKey] !== undefined) {
      appointmentDate = toIsoDate(sr[apptDateKey]);
    }
    if (getBool(sr, doneKey)) testDone = true;
    if (getBool(sr, reportKey)) reportCollected = true;
    if (getBool(sr, flagKey)) problemFlagged = true;
  }

  // Derive ordered from appointment presence if not explicit
  if (!ordered && appointmentStatus !== "NONE") {
    ordered = true;
  }

  return {
    ordered,
    appointmentStatus,
    appointmentDate,
    testDone,
    reportCollected,
    problemFlagged,
  };
}

// -----------------------------------------------------------------------
// Stage deriver
// -----------------------------------------------------------------------

function deriveStage(
  hasInvestigationData: boolean,
  hasTreatmentPlan: boolean,
  hasNact: boolean,
  hasSurgery: boolean
): PatientAnalysisRow["currentStage"] {
  if (hasSurgery) return "SURGERY";
  if (hasNact) return "NACT";
  if (hasTreatmentPlan) return "TREATMENT_PLANNED";
  if (hasInvestigationData) return "INVESTIGATIONS";
  return "REGISTERED";
}

// -----------------------------------------------------------------------
// Issues deriver
// -----------------------------------------------------------------------

function deriveIssues(
  investigations: Record<string, InvestigationData>,
  treatmentPlan: PatientAnalysisRow["treatmentPlan"],
  nact: PatientAnalysisRow["nact"]
): Array<PatientAnalysisRow["issues"][number]> {
  const issues: Array<PatientAnalysisRow["issues"][number]> = [];

  // MISSED_APPT: any investigation with MISSED appointment status
  const hasMissedAppt = Object.values(investigations).some(
    (inv) => inv.appointmentStatus === "MISSED"
  );
  if (hasMissedAppt) issues.push("MISSED_APPT");

  // NO_REPORT: ordered + done but report not collected
  const hasNoReport = Object.values(investigations).some(
    (inv) => inv.ordered && inv.testDone && !inv.reportCollected
  );
  if (hasNoReport) issues.push("NO_REPORT");

  // CHEMO_ISSUE: tumor growing or unable to complete
  if (nact.tumorGrowing || nact.unableToComplete) issues.push("CHEMO_ISSUE");

  // CLIPS_MISSING: chemo started but clips missing
  if (nact.chemoStartedClipsMissing) issues.push("CLIPS_MISSING");

  // NO_PLAN: treatment not decided
  if (treatmentPlan.notDecidedYet) issues.push("NO_PLAN");

  return issues;
}

// -----------------------------------------------------------------------
// Public Repository Class
// -----------------------------------------------------------------------

export class AdvancedAnalysisRepository {
  /**
   * Fetch all active patients for a doctor along with their BubbleScanResult records.
   */
  async findPatientsForDoctor(doctorId: string): Promise<PatientWithScans[]> {
    // Step 1: fetch patients for this doctor
    const patients = await Patient.findAll({
      where: {
        doctorId,
        status: { [Op.in]: ["ACTIVE", "CRITICAL", "ON_HOLD", "COMPLETED"] },
      },
      order: [["createdAt", "ASC"]],
    });

    if (patients.length === 0) return [];

    // Step 2: fetch all bubble scans for these patients in one query
    // (Patient has no @HasMany for BubbleScanResult — query separately)
    const patientIds = patients.map((p) => p.id);
    const allScans = await BubbleScanResult.findAll({
      where: {
        patientId: { [Op.in]: patientIds },
        processingStatus: "completed",
      },
      order: [["pageNumber", "ASC"]],
    });

    // Step 3: group scans by patientId
    const scansByPatient = new Map<string, BubbleScanResult[]>();
    for (const scan of allScans) {
      const existing = scansByPatient.get(scan.patientId) ?? [];
      existing.push(scan);
      scansByPatient.set(scan.patientId, existing);
    }

    return patients.map((p) => ({
      patient: p,
      scans: scansByPatient.get(p.id) ?? [],
    }));
  }

  /**
   * Map a raw patient + scans into a PatientAnalysisRow.
   */
  mapToPatientAnalysisRow(patient: unknown, scans: unknown[]): PatientAnalysisRow {
    const p = patient as Patient;
    const typedScans = scans as BubbleScanResult[];

    // Partition scans by page ranges
    const orderedPageScans = typedScans
      .filter((s) => s.pageNumber !== undefined && s.pageNumber >= 5 && s.pageNumber <= 6)
      .map(safeScanResults);

    const detailPageScans = typedScans
      .filter((s) => s.pageNumber !== undefined && s.pageNumber >= 7 && s.pageNumber <= 28)
      .map(safeScanResults);

    const treatmentPlanScans = typedScans
      .filter((s) => s.pageNumber === 29)
      .map(safeScanResults);

    const nactScans = typedScans
      .filter((s) => s.pageNumber !== undefined && s.pageNumber >= 30 && s.pageNumber <= 36)
      .map(safeScanResults);

    const surgeryScans = typedScans
      .filter((s) => s.pageNumber !== undefined && s.pageNumber >= 37 && s.pageNumber <= 38)
      .map(safeScanResults);

    // ---- Build investigations ----
    const investigations: Record<string, InvestigationData> = {};
    for (const inv of INVESTIGATIONS) {
      investigations[inv.key] = buildInvestigationData(
        inv.key,
        orderedPageScans,
        detailPageScans
      );
    }

    // ---- Build treatment plan ----
    const tpSr: RawScanResults = treatmentPlanScans.length > 0 ? treatmentPlanScans[0] : {};
    const rawSurgeryType = getString(tpSr, "surgeryType");
    let surgeryType: "BCS" | "MASTECTOMY" | null = null;
    if (rawSurgeryType === "BCS") surgeryType = "BCS";
    else if (rawSurgeryType === "MASTECTOMY") surgeryType = "MASTECTOMY";

    const treatmentPlan: PatientAnalysisRow["treatmentPlan"] = {
      nact: getBool(tpSr, "nactPlanned"),
      surgeryType,
      radiotherapy: getBool(tpSr, "radiotherapyPlanned"),
      notDecidedYet: getBool(tpSr, "treatmentNotDecided"),
    };

    // ---- Build NACT ----
    const nactMerged: RawScanResults = {};
    for (const sr of nactScans) {
      Object.assign(nactMerged, sr);
    }

    const rawNactStatus = getString(nactMerged, "nactStatus");
    let nactStatus: PatientAnalysisRow["nact"]["status"] = "NOT_STARTED";
    if (rawNactStatus === "IN_PROGRESS") nactStatus = "IN_PROGRESS";
    else if (rawNactStatus === "COMPLETED") nactStatus = "COMPLETED";

    const nact: PatientAnalysisRow["nact"] = {
      status: nactStatus,
      startDate: toIsoDate(nactMerged["nactStartDate"]),
      lastCycleDate: toIsoDate(nactMerged["lastCycleDate"]),
      clipsBreast: getBool(nactMerged, "clipsBreast"),
      clipsAxilla: getBool(nactMerged, "clipsAxilla"),
      tumorGrowing: getBool(nactMerged, "tumorGrowingOnChemo"),
      unableToComplete: getBool(nactMerged, "unableToCompleteChemo"),
      chemoStartedClipsMissing: getBool(nactMerged, "chemoStartedClipsMissing"),
    };

    // ---- Build surgery ----
    const surgMerged: RawScanResults = {};
    for (const sr of surgeryScans) {
      Object.assign(surgMerged, sr);
    }

    const surgery: PatientAnalysisRow["surgery"] = {
      admissionDate: toIsoDate(surgMerged["surgeryAdmissionDate"]),
      admissionStatus: getString(surgMerged, "surgeryAdmissionStatus"),
      radiationDate: toIsoDate(surgMerged["radiationDate"]),
      radiationStatus: getString(surgMerged, "radiationStatus"),
    };

    // ---- Derive stage ----
    const hasInvestigationData = Object.values(investigations).some((inv) => inv.ordered);
    const hasTreatmentPlan =
      treatmentPlan.nact ||
      treatmentPlan.surgeryType !== null ||
      treatmentPlan.radiotherapy ||
      treatmentPlan.notDecidedYet;
    const hasNact = nact.status !== "NOT_STARTED" || nactScans.length > 0;
    const hasSurgery = surgeryScans.length > 0 && surgery.admissionDate !== null;

    const currentStage = deriveStage(
      hasInvestigationData,
      hasTreatmentPlan,
      hasNact,
      hasSurgery
    );

    // ---- Derive issues ----
    const issues = deriveIssues(investigations, treatmentPlan, nact);

    // ---- Last activity date ----
    const latestScan = typedScans.reduce<BubbleScanResult | null>((latest, s) => {
      if (!latest) return s;
      const latestTime = latest.scannedAt ? new Date(latest.scannedAt).getTime() : 0;
      const sTime = s.scannedAt ? new Date(s.scannedAt).getTime() : 0;
      return sTime > latestTime ? s : latest;
    }, null);

    const lastActivityDate =
      latestScan?.scannedAt
        ? new Date(latestScan.scannedAt).toISOString()
        : p.updatedAt
        ? new Date(p.updatedAt).toISOString()
        : new Date().toISOString();

    return {
      patientId: p.id,
      name: p.fullName,
      uhid: p.diaryId ?? p.id,
      age: p.age ?? 0,
      sex: p.gender ?? "OTHER",
      currentStage,
      investigations,
      treatmentPlan,
      nact,
      surgery,
      issues,
      issueCount: issues.length,
      lastActivityDate,
    };
  }

  /**
   * Apply all filter criteria (AND logic) to a list of PatientAnalysisRows.
   */
  applyFilters(
    rows: PatientAnalysisRow[],
    filter: AdvancedAnalysisFilter
  ): PatientAnalysisRow[] {
    return rows.filter((row) => {
      // Age range
      if (filter.ageMin !== undefined && row.age < filter.ageMin) return false;
      if (filter.ageMax !== undefined && row.age > filter.ageMax) return false;

      // Sex
      if (filter.sex !== "ALL") {
        const rowSex = row.sex.toUpperCase();
        if (rowSex !== filter.sex) return false;
      }

      // Investigations filter
      if (filter.investigations) {
        for (const [key, status] of Object.entries(filter.investigations)) {
          if (status === "ANY") continue;
          const inv = row.investigations[key];
          if (!inv) return false;

          if (status === "ORDERED_NOT_SCHEDULED") {
            if (!(inv.ordered && inv.appointmentStatus === "NONE")) return false;
          } else if (status === "SCHEDULED") {
            if (inv.appointmentStatus !== "SCHEDULED") return false;
          } else if (status === "COMPLETED_NO_REPORT") {
            if (!(inv.testDone && !inv.reportCollected)) return false;
          } else if (status === "COMPLETED_REPORT_COLLECTED") {
            if (!(inv.testDone && inv.reportCollected)) return false;
          } else if (status === "MISSED") {
            if (inv.appointmentStatus !== "MISSED") return false;
          } else if (status === "CANCELLED") {
            if (inv.appointmentStatus !== "CANCELLED") return false;
          } else if (status === "PROBLEM_FLAGGED") {
            if (!inv.problemFlagged) return false;
          }
        }
      }

      // NACT planned
      if (filter.nactPlanned !== "ANY") {
        const expected = filter.nactPlanned === "YES";
        if (row.treatmentPlan.nact !== expected) return false;
      }

      // Surgery type
      if (filter.surgeryType !== "ANY") {
        if (filter.surgeryType === "NOT_PLANNED") {
          if (row.treatmentPlan.surgeryType !== null) return false;
        } else {
          if (row.treatmentPlan.surgeryType !== filter.surgeryType) return false;
        }
      }

      // Radiotherapy planned
      if (filter.radiotherapyPlanned !== "ANY") {
        const expected = filter.radiotherapyPlanned === "YES";
        if (row.treatmentPlan.radiotherapy !== expected) return false;
      }

      // Treatment not decided
      if (filter.treatmentNotDecided !== "ANY") {
        const expected = filter.treatmentNotDecided === "YES";
        if (row.treatmentPlan.notDecidedYet !== expected) return false;
      }

      // NACT status
      if (filter.nactStatus !== "ANY") {
        if (row.nact.status !== filter.nactStatus) return false;
      }

      // Clips breast
      if (filter.clipsBreast !== "ANY") {
        const expected = filter.clipsBreast === "YES";
        if (row.nact.clipsBreast !== expected) return false;
      }

      // Clips axilla
      if (filter.clipsAxilla !== "ANY") {
        const expected = filter.clipsAxilla === "YES";
        if (row.nact.clipsAxilla !== expected) return false;
      }

      // Tumor growing on chemo
      if (filter.tumorGrowingOnChemo !== "ANY") {
        const expected = filter.tumorGrowingOnChemo === "YES";
        if (row.nact.tumorGrowing !== expected) return false;
      }

      // Unable to complete chemo
      if (filter.unableToCompleteChemo !== "ANY") {
        const expected = filter.unableToCompleteChemo === "YES";
        if (row.nact.unableToComplete !== expected) return false;
      }

      // Chemo started, clips missing
      if (filter.chemoStartedClipsMissing !== "ANY") {
        const expected = filter.chemoStartedClipsMissing === "YES";
        if (row.nact.chemoStartedClipsMissing !== expected) return false;
      }

      // Radiation booked
      if (filter.radiationBooked !== "ANY") {
        const rs = (row.surgery.radiationStatus ?? "").toUpperCase();
        if (filter.radiationBooked === "YES" && rs !== "BOOKED") return false;
        if (filter.radiationBooked === "NO" && rs === "BOOKED") return false;
        if (filter.radiationBooked === "MISSED" && rs !== "MISSED") return false;
        if (filter.radiationBooked === "CANCELLED" && rs !== "CANCELLED") return false;
      }

      // Surgery admission
      if (filter.surgeryAdmission !== "ANY") {
        const as_ = (row.surgery.admissionStatus ?? "").toUpperCase();
        if (filter.surgeryAdmission === "YES" && as_ !== "ADMITTED") return false;
        if (filter.surgeryAdmission === "NO" && as_ === "ADMITTED") return false;
        if (filter.surgeryAdmission === "MISSED" && as_ !== "MISSED") return false;
        if (filter.surgeryAdmission === "CANCELLED" && as_ !== "CANCELLED") return false;
      }

      return true;
    });
  }

  /**
   * Apply sorting to a list of PatientAnalysisRows.
   */
  applySorting(rows: PatientAnalysisRow[], sortBy: string): PatientAnalysisRow[] {
    const sorted = [...rows];
    switch (sortBy) {
      case "name_asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "name_desc":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "most_issues":
        sorted.sort((a, b) => b.issueCount - a.issueCount);
        break;
      case "latest_activity":
        sorted.sort(
          (a, b) =>
            new Date(b.lastActivityDate).getTime() -
            new Date(a.lastActivityDate).getTime()
        );
        break;
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }
}

export const advancedAnalysisRepository = new AdvancedAnalysisRepository();
