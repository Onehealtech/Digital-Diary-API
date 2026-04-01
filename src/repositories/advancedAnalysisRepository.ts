import { Op } from "sequelize";
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
// scanResults stores answers as nested objects: { answer: "yes"/"no"/"Scheduled"/..., confidence, ... }
// -----------------------------------------------------------------------

/**
 * Extracts the raw answer value from a scan result entry.
 * Handles both nested { answer: ... } objects and raw values.
 */
function getAnswer(obj: RawScanResults, key: string): unknown {
  const val = obj[key];
  if (val === null || val === undefined) return null;
  if (typeof val === "object" && !Array.isArray(val) && "answer" in (val as Record<string, unknown>)) {
    return (val as Record<string, unknown>).answer;
  }
  return val;
}

/**
 * Returns true if the question answer is truthy ("yes", true, 1).
 */
function getBool(obj: RawScanResults, key: string): boolean {
  const val = getAnswer(obj, key);
  if (val === null || val === undefined) return false;
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val === "yes" || val === "true" || val === "1";
  if (typeof val === "number") return val === 1;
  return false;
}

/**
 * Returns the string answer value, or null if empty/missing.
 */
function getString(obj: RawScanResults, key: string): string | null {
  const val = getAnswer(obj, key);
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
// Select options in diary: "Scheduled", "Completed", "Missed", "Cancelled"
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

/**
 * Resolves the most recent appointment status from a schedule page.
 * Checks q1_status first, then q2_status if q1 was missed/cancelled.
 * Returns { status, date }.
 */
function resolveScheduleStatus(
  sr: RawScanResults
): { status: "NONE" | "SCHEDULED" | "COMPLETED" | "MISSED" | "CANCELLED"; date: string | null } {
  const s1 = parseAppointmentStatus(getString(sr, "q1_status"));
  const d1 = toIsoDate(getAnswer(sr, "q1_date"));

  if (s1 === "NONE") return { status: "NONE", date: null };

  // If q1 was completed/scheduled, that's the final status
  if (s1 === "SCHEDULED" || s1 === "COMPLETED") return { status: s1, date: d1 };

  // q1 was missed/cancelled — check q2 for re-appointment
  const s2 = parseAppointmentStatus(getString(sr, "q2_status"));
  if (s2 !== "NONE") {
    return { status: s2, date: toIsoDate(getAnswer(sr, "q2_date")) ?? d1 };
  }

  return { status: s1, date: d1 };
}

// -----------------------------------------------------------------------
// Per-investigation page configuration
//
// Diary page structure:
//   Pages 5-6: Investigation Summary (ordered flags, one question per investigation)
//   Pages 7-28: Schedule + Done/Report pages per investigation
//   Page 29:   Treatment Plan
//   Pages 30-36: NACT tracking
//   Pages 37-38: Surgery / Radiation
//
// question IDs in scanResults:
//   Summary pages: q1..q7 (yes/no per investigation)
//   Schedule pages: q1_date, q1_status, q2_date, q2_status, q3
//   Done/Report pages: q1=done, q2=report collected, q3=problem
//     (Biopsy p12, FNAC p14: q1=right done, q2=left done, q3=report, q4=problem)
//     (Chest Xray p27: q1=PA View done, q2=report, q3=problem)
// -----------------------------------------------------------------------

interface InvPageConfig {
  orderedPage: number;
  orderedQId: string;
  schedulePage?: number;
  donePage?: number;
  doneQIds: string[];   // question IDs that indicate "test done"
  reportQId: string;    // question ID for "report collected"
  problemQId: string;   // question ID for "problem flagged"
}

const INV_PAGE_CONFIG: Record<string, InvPageConfig> = {
  mammogram:        { orderedPage: 5, orderedQId: "q1", schedulePage: 7,  donePage: 8,  doneQIds: ["q1"], reportQId: "q2", problemQId: "q3" },
  usgBreast:        { orderedPage: 5, orderedQId: "q2", schedulePage: 9,  donePage: 10, doneQIds: ["q1"], reportQId: "q2", problemQId: "q3" },
  biopsyBreast:     { orderedPage: 5, orderedQId: "q3", schedulePage: 11, donePage: 12, doneQIds: ["q1", "q2"], reportQId: "q3", problemQId: "q4" },
  fnacAxillary:     { orderedPage: 5, orderedQId: "q4", schedulePage: 13, donePage: 14, doneQIds: ["q1", "q2"], reportQId: "q3", problemQId: "q4" },
  petCt:            { orderedPage: 5, orderedQId: "q5", schedulePage: 15, donePage: 16, doneQIds: ["q1"], reportQId: "q2", problemQId: "q3" },
  mriBreasts:       { orderedPage: 5, orderedQId: "q6", schedulePage: 17, donePage: 18, doneQIds: ["q1"], reportQId: "q2", problemQId: "q3" },
  geneticTesting:   { orderedPage: 5, orderedQId: "q7", schedulePage: 19, donePage: 20, doneQIds: ["q1"], reportQId: "q2", problemQId: "q3" },
  mugaScan:         { orderedPage: 6, orderedQId: "q1", schedulePage: 21, donePage: 22, doneQIds: ["q1"], reportQId: "q2", problemQId: "q3" },
  echocardiography: { orderedPage: 6, orderedQId: "q2", schedulePage: 23, donePage: 24, doneQIds: ["q1"], reportQId: "q2", problemQId: "q3" },
  boneDexa:         { orderedPage: 6, orderedQId: "q3",                   donePage: 25, doneQIds: ["q1"], reportQId: "q2", problemQId: "q3" },
  ecg:              { orderedPage: 6, orderedQId: "q4",                   donePage: 26, doneQIds: ["q1"], reportQId: "q2", problemQId: "q3" },
  chestXray:        { orderedPage: 6, orderedQId: "q5",                   donePage: 27, doneQIds: ["q1"], reportQId: "q2", problemQId: "q3" },
  bloodTests:       { orderedPage: 6, orderedQId: "q6",                   donePage: 28, doneQIds: ["q1"], reportQId: "q2", problemQId: "q3" },
  otherTests:       { orderedPage: 6, orderedQId: "q7",                   donePage: undefined, doneQIds: [], reportQId: "q2", problemQId: "q3" },
};

// -----------------------------------------------------------------------
// Per-investigation extractor using page-specific question IDs
// -----------------------------------------------------------------------

function buildInvestigationData(
  key: string,
  scansByPage: Map<number, RawScanResults[]>
): InvestigationData {
  const config = INV_PAGE_CONFIG[key];
  if (!config) {
    return { ordered: false, appointmentStatus: "NONE", appointmentDate: null, testDone: false, reportCollected: false, problemFlagged: false };
  }

  // --- Ordered flag from summary page (page 5 or 6) ---
  let ordered = false;
  const orderedPageScans = scansByPage.get(config.orderedPage) ?? [];
  for (const sr of orderedPageScans) {
    if (getBool(sr, config.orderedQId)) {
      ordered = true;
      break;
    }
  }

  // --- Appointment status/date from schedule page ---
  let appointmentStatus: InvestigationData["appointmentStatus"] = "NONE";
  let appointmentDate: string | null = null;

  if (config.schedulePage) {
    const scheduleScans = scansByPage.get(config.schedulePage) ?? [];
    for (const sr of scheduleScans) {
      const resolved = resolveScheduleStatus(sr);
      if (resolved.status !== "NONE") {
        appointmentStatus = resolved.status;
        appointmentDate = resolved.date;
        break;
      }
    }
  }

  // --- Done / Report / Problem from done page ---
  let testDone = false;
  let reportCollected = false;
  let problemFlagged = false;

  if (config.donePage !== undefined) {
    const donePageScans = scansByPage.get(config.donePage) ?? [];
    for (const sr of donePageScans) {
      if (config.doneQIds.some((qId) => getBool(sr, qId))) testDone = true;
      if (getBool(sr, config.reportQId)) reportCollected = true;
      if (getBool(sr, config.problemQId)) problemFlagged = true;
      // Also check the "problem getting report" question (next QID after problemQId)
      const problemQNum = parseInt(config.problemQId.replace("q", ""), 10);
      if (!isNaN(problemQNum) && getBool(sr, `q${problemQNum + 1}`)) problemFlagged = true;
    }
  }

  // Derive ordered from appointment presence if not explicit
  if (!ordered && appointmentStatus !== "NONE") {
    ordered = true;
  }

  return { ordered, appointmentStatus, appointmentDate, testDone, reportCollected, problemFlagged };
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

    // Step 2: fetch all completed bubble scans for these patients in one query
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

    // Build a page-number → scan results map for O(1) lookup
    const scansByPage = new Map<number, RawScanResults[]>();
    for (const scan of typedScans) {
      if (scan.pageNumber != null) {
        const existing = scansByPage.get(scan.pageNumber) ?? [];
        existing.push(safeScanResults(scan));
        scansByPage.set(scan.pageNumber, existing);
      }
    }

    // ---- Build investigations ----
    const investigations: Record<string, InvestigationData> = {};
    for (const inv of INVESTIGATIONS) {
      investigations[inv.key] = buildInvestigationData(inv.key, scansByPage);
    }

    // ---- Build treatment plan (Page 29) ----
    // Page 29 questions:
    //   q1 = Planned For Chemotherapy (NACT)  [yes/no]
    //   q2 = Surgery Planned                   [select: BCS / Mastectomy]
    const page29Scans = scansByPage.get(29) ?? [];
    let nactPlanned = false;
    let surgeryType: "BCS" | "MASTECTOMY" | null = null;

    for (const sr of page29Scans) {
      if (getBool(sr, "q1")) nactPlanned = true;
      const rawSurgery = getString(sr, "q2");
      if (rawSurgery) {
        const upper = rawSurgery.toUpperCase();
        if (upper === "BCS") surgeryType = "BCS";
        else if (upper === "MASTECTOMY") surgeryType = "MASTECTOMY";
      }
    }

    const treatmentPlan: PatientAnalysisRow["treatmentPlan"] = {
      nact: nactPlanned,
      surgeryType,
      radiotherapy: false,    // No radiotherapy question in current page 29 definition
      notDecidedYet: false,   // No "treatment not decided" question in current page 29 definition
    };

    // ---- Build NACT ----
    // Page 30: q1=clipsBreast, q2=clipsAxilla
    // Page 33: q1=chemoStartedClipsMissing
    // Page 34: q1_date=NACT start date, q1_status=status
    // Page 35: q1=tumorGrowing, q2=unableToComplete
    // Page 36: q1_date=last cycle date, q1_status=status
    const page30Scans = scansByPage.get(30) ?? [];
    const page33Scans = scansByPage.get(33) ?? [];
    const page34Scans = scansByPage.get(34) ?? [];
    const page35Scans = scansByPage.get(35) ?? [];
    const page36Scans = scansByPage.get(36) ?? [];

    const clipsBreast = page30Scans.some((sr) => getBool(sr, "q1"));
    const clipsAxilla = page30Scans.some((sr) => getBool(sr, "q2"));
    const chemoStartedClipsMissing = page33Scans.some((sr) => getBool(sr, "q1"));
    const tumorGrowing = page35Scans.some((sr) => getBool(sr, "q1"));
    const unableToComplete = page35Scans.some((sr) => getBool(sr, "q2"));

    let nactStartDate: string | null = null;
    for (const sr of page34Scans) {
      const d = toIsoDate(getAnswer(sr, "q1_date"));
      if (d) { nactStartDate = d; break; }
    }

    let lastCycleDate: string | null = null;
    for (const sr of page36Scans) {
      const d = toIsoDate(getAnswer(sr, "q1_date"));
      if (d) { lastCycleDate = d; break; }
    }

    // NACT status: COMPLETED if page 36 has "Completed" status,
    //              IN_PROGRESS if page 34 has any data,
    //              otherwise NOT_STARTED
    let nactStatus: PatientAnalysisRow["nact"]["status"] = "NOT_STARTED";
    for (const sr of page36Scans) {
      const s = getString(sr, "q1_status");
      if (s && s.toUpperCase() === "COMPLETED") {
        nactStatus = "COMPLETED";
        break;
      }
    }
    if (nactStatus === "NOT_STARTED" && page34Scans.length > 0) {
      nactStatus = "IN_PROGRESS";
    }

    const nact: PatientAnalysisRow["nact"] = {
      status: nactStatus,
      startDate: nactStartDate,
      lastCycleDate,
      clipsBreast,
      clipsAxilla,
      tumorGrowing,
      unableToComplete,
      chemoStartedClipsMissing,
    };

    // ---- Build surgery ----
    // Page 37: q1_date=radiation date, q1_status=radiation status
    // Page 38: q1_date=admission date, q1_status=admission status
    const page37Scans = scansByPage.get(37) ?? [];
    const page38Scans = scansByPage.get(38) ?? [];

    let radiationDate: string | null = null;
    let radiationStatus: string | null = null;
    for (const sr of page37Scans) {
      const resolved = resolveScheduleStatus(sr);
      if (resolved.status !== "NONE") {
        radiationDate = resolved.date;
        radiationStatus = resolved.status;
        break;
      }
    }

    let admissionDate: string | null = null;
    let admissionStatus: string | null = null;
    for (const sr of page38Scans) {
      const resolved = resolveScheduleStatus(sr);
      if (resolved.status !== "NONE") {
        admissionDate = resolved.date;
        admissionStatus = resolved.status;
        break;
      }
    }

    const surgery: PatientAnalysisRow["surgery"] = {
      admissionDate,
      admissionStatus,
      radiationDate,
      radiationStatus,
    };

    // ---- Derive stage ----
    const hasInvestigationData = Object.values(investigations).some((inv) => inv.ordered);
    const hasTreatmentPlan =
      treatmentPlan.nact ||
      treatmentPlan.surgeryType !== null ||
      treatmentPlan.radiotherapy ||
      treatmentPlan.notDecidedYet;
    const nactPageNums = [30, 31, 32, 33, 34, 35, 36];
    const hasNactScans = nactPageNums.some((p) => (scansByPage.get(p)?.length ?? 0) > 0);
    const hasNact = nact.status !== "NOT_STARTED" || hasNactScans;
    const hasSurgery = page38Scans.length > 0 && admissionDate !== null;

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
      // Specific patient IDs
      if (filter.patientIds?.length && !filter.patientIds.includes(row.patientId)) return false;

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

      // Radiation booked (status: SCHEDULED or COMPLETED means booked)
      if (filter.radiationBooked !== "ANY") {
        const rs = (row.surgery.radiationStatus ?? "").toUpperCase();
        if (filter.radiationBooked === "YES" && rs !== "SCHEDULED" && rs !== "COMPLETED") return false;
        if (filter.radiationBooked === "NO" && (rs === "SCHEDULED" || rs === "COMPLETED")) return false;
        if (filter.radiationBooked === "MISSED" && rs !== "MISSED") return false;
        if (filter.radiationBooked === "CANCELLED" && rs !== "CANCELLED") return false;
      }

      // Surgery admission (status: SCHEDULED or COMPLETED means admitted/booked)
      if (filter.surgeryAdmission !== "ANY") {
        const as_ = (row.surgery.admissionStatus ?? "").toUpperCase();
        if (filter.surgeryAdmission === "YES" && as_ !== "SCHEDULED" && as_ !== "COMPLETED") return false;
        if (filter.surgeryAdmission === "NO" && (as_ === "SCHEDULED" || as_ === "COMPLETED")) return false;
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
