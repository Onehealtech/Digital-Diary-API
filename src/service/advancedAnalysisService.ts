import { AdvancedAnalysisRepository } from "../repositories/advancedAnalysisRepository";
import type {
  AdvancedAnalysisFilter,
  PatientAnalysisRow,
  AnalyticsResponse,
  PatientStage,
  InvCompletionStatus,
  TreatmentPlan,
  IssueType,
  GenderType,
  ActivityType,
  DateGroup,
  AppointmentDateGroup,
  AppointmentStatus,
} from "./advancedAnalysisTypes";
import { INVESTIGATIONS } from "./advancedAnalysisTypes";
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
    filter: AdvancedAnalysisFilter,
    patientIds?: string[] | null
  ): Promise<{
    patients: PatientAnalysisRow[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    if (!doctorId) {
      throw new AppError(400, "Doctor ID is required");
    }

    const allPatients = await repo.findPatientsForDoctor(doctorId, patientIds);

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

  async getAnalytics(
    doctorId: string,
    dateRange: "7d" | "30d" | "90d" | "all" = "30d",
    filter?: AdvancedAnalysisFilter,
    patientIds?: string[] | null
  ): Promise<AnalyticsResponse> {
    if (!doctorId) throw new AppError(400, "Doctor ID is required");

    const patientsWithScans = await repo.findPatientsForDoctor(doctorId, patientIds);

    // Map all patients to rows, then apply filter if provided
    let rows: PatientAnalysisRow[] = patientsWithScans.map(({ patient, scans }) =>
      repo.mapToPatientAnalysisRow(patient, scans)
    );

    if (filter) {
      rows = repo.applyFilters(rows, filter);
      rows = applySearchFilter(rows, filter.search);
    }

    const total = rows.length;
    const now = new Date();

    // Resolve the start of the selected date range window
    const rangeStart: Date | null =
      dateRange === "7d"  ? new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000) :
      dateRange === "30d" ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) :
      dateRange === "90d" ? new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) :
      null; // "all" — no cutoff

    // ── KPI ─────────────────────────────────────────────────────────────
    const newInRange = patientsWithScans.filter(({ patient }) => {
      if (!patient.createdAt) return false;
      if (rangeStart === null) return true;
      return new Date(patient.createdAt) >= rangeStart;
    }).length;

    const updatesInRange = rows.filter((r) => {
      if (rangeStart === null) return true;
      return new Date(r.lastActivityDate) >= rangeStart;
    }).length;

    let totalOrdered = 0;
    let totalDoneWithReport = 0;
    for (const row of rows) {
      for (const inv of Object.values(row.investigations)) {
        if (inv.ordered) {
          totalOrdered++;
          if (inv.testDone && inv.reportCollected) totalDoneWithReport++;
        }
      }
    }
    const investigationCompletionRate =
      totalOrdered > 0 ? Math.round((totalDoneWithReport / totalOrdered) * 100) : 0;

    const patientsNeedingAction = rows.filter((r) => r.issueCount > 0).length;
    const criticalSafetyFlags = rows.filter(
      (r) => r.issues.includes("CLIPS_MISSING") || r.issues.includes("CHEMO_ISSUE")
    ).length;

    // ── Stage Distribution ───────────────────────────────────────────────
    const stageCountsMap: Record<PatientStage, number> = {
      REGISTERED: 0, INVESTIGATIONS: 0, TREATMENT_PLANNED: 0, NACT: 0, SURGERY: 0,
    };
    for (const row of rows) stageCountsMap[row.currentStage]++;

    const stageDistribution = (Object.entries(stageCountsMap) as [PatientStage, number][]).map(
      ([stage, count]) => ({
        stage,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      })
    );

    // ── Investigation Completion ─────────────────────────────────────────
    const invStatusMap: Record<InvCompletionStatus, number> = {
      DONE_REPORT: 0, DONE_NO_REPORT: 0, MISSED: 0, SCHEDULED: 0, PENDING: 0,
    };
    let invTotal = 0;
    for (const row of rows) {
      for (const inv of Object.values(row.investigations)) {
        if (!inv.ordered) continue;
        invTotal++;
        if (inv.testDone && inv.reportCollected)        invStatusMap.DONE_REPORT++;
        else if (inv.testDone && !inv.reportCollected)  invStatusMap.DONE_NO_REPORT++;
        else if (inv.appointmentStatus === "MISSED")    invStatusMap.MISSED++;
        else if (inv.appointmentStatus === "SCHEDULED") invStatusMap.SCHEDULED++;
        else                                            invStatusMap.PENDING++;
      }
    }
    const investigationCompletion = (
      Object.entries(invStatusMap) as [InvCompletionStatus, number][]
    ).map(([status, count]) => ({
      status,
      count,
      percentage: invTotal > 0 ? Math.round((count / invTotal) * 100) : 0,
    }));

    // ── Treatment Breakdown ──────────────────────────────────────────────
    const treatMap: Record<TreatmentPlan, number> = {
      NACT_BCS: 0, NACT_MASTECTOMY: 0, BCS_ONLY: 0, MASTECTOMY_ONLY: 0,
      RT_ADDED: 0, NOT_PLANNED: 0,
    };
    for (const row of rows) {
      const { nact, surgeryType, radiotherapy } = row.treatmentPlan;
      if (radiotherapy)                          treatMap.RT_ADDED++;
      else if (nact && surgeryType === "BCS")    treatMap.NACT_BCS++;
      else if (nact && surgeryType === "MASTECTOMY") treatMap.NACT_MASTECTOMY++;
      else if (!nact && surgeryType === "BCS")   treatMap.BCS_ONLY++;
      else if (!nact && surgeryType === "MASTECTOMY") treatMap.MASTECTOMY_ONLY++;
      else                                       treatMap.NOT_PLANNED++;
    }
    const treatmentBreakdown = (Object.entries(treatMap) as [TreatmentPlan, number][]).map(
      ([plan, count]) => ({
        plan,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      })
    );

    // ── Active Issues ────────────────────────────────────────────────────
    const issueMap: Record<IssueType, number> = {
      CLIPS_MISSING: 0, CHEMO_ISSUE: 0, MISSED_APPOINTMENT: 0,
      NO_REPORT: 0, NO_TREATMENT_PLAN: 0,
    };
    for (const row of rows) {
      for (const issue of row.issues) {
        if (issue === "MISSED_APPT")    issueMap.MISSED_APPOINTMENT++;
        else if (issue === "NO_REPORT")       issueMap.NO_REPORT++;
        else if (issue === "CHEMO_ISSUE")     issueMap.CHEMO_ISSUE++;
        else if (issue === "CLIPS_MISSING")   issueMap.CLIPS_MISSING++;
        else if (issue === "NO_PLAN")         issueMap.NO_TREATMENT_PLAN++;
      }
    }
    const totalIssues = Object.values(issueMap).reduce((a, b) => a + b, 0);
    const activeIssues = (Object.entries(issueMap) as [IssueType, number][])
      .map(([issue, count]) => ({
        issue,
        count,
        percentage: totalIssues > 0 ? Math.round((count / totalIssues) * 100) : 0,
      }));

    // ── Gender Distribution ──────────────────────────────────────────────
    const genderMap: Record<GenderType, number> = { FEMALE: 0, MALE: 0, OTHER: 0 };
    for (const row of rows) {
      const g = (row.sex ?? "OTHER").toUpperCase();
      if (g === "FEMALE") genderMap.FEMALE++;
      else if (g === "MALE") genderMap.MALE++;
      else genderMap.OTHER++;
    }
    const genderDistribution = (Object.entries(genderMap) as [GenderType, number][]).map(
      ([gender, count]) => ({
        gender,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      })
    );

    // ── Monthly Registrations (last 12 months) ───────────────────────────
    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const monthlyMap = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyMap.set(`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, 0);
    }
    for (const { patient } of patientsWithScans) {
      if (!patient.createdAt) continue;
      const d = new Date(patient.createdAt);
      const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      if (monthlyMap.has(key)) monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1);
    }
    const monthlyRegistrations = Array.from(monthlyMap.entries()).map(([month, count]) => ({
      month,
      count,
    }));

    // ── Stage Funnel ─────────────────────────────────────────────────────
    const STAGE_META: { key: PatientStage; label: string; color: string }[] = [
      { key: "REGISTERED",        label: "Registered",        color: "#B2C5DE" },
      { key: "INVESTIGATIONS",    label: "Investigations",    color: "#68CACB" },
      { key: "TREATMENT_PLANNED", label: "Treatment Planned", color: "#007787" },
      { key: "NACT",              label: "NACT / Chemo",      color: "#0E2F5A" },
      { key: "SURGERY",           label: "Surgery",           color: "#1E40AF" },
    ];
    const stageFunnel = STAGE_META.map(({ key, label, color }) => ({
      stage: label,
      count: stageCountsMap[key],
      percentage: total > 0 ? Math.round((stageCountsMap[key] / total) * 100) : 0,
      color,
    }));

    // ── Investigation Heatmap ────────────────────────────────────────────
    const INV_GROUP_MAP: Record<string, "IMAGING" | "PATHOLOGY" | "CARDIAC_BASELINE"> = {
      mammogram: "IMAGING", usgBreast: "IMAGING", mriBreasts: "IMAGING",
      petCt: "IMAGING", chestXray: "IMAGING",
      biopsyBreast: "PATHOLOGY", fnacAxillary: "PATHOLOGY", geneticTesting: "PATHOLOGY",
      mugaScan: "CARDIAC_BASELINE", echocardiography: "CARDIAC_BASELINE",
      boneDexa: "CARDIAC_BASELINE", ecg: "CARDIAC_BASELINE",
      bloodTests: "CARDIAC_BASELINE", otherTests: "CARDIAC_BASELINE",
    };
    const investigationHeatmap = INVESTIGATIONS.map(({ key, label }) => {
      let ordered = 0, scheduled = 0, doneWithReport = 0, doneNoReport = 0;
      let missed = 0, cancelled = 0, pending = 0, problemFlagged = 0;
      for (const row of rows) {
        const inv = row.investigations[key];
        if (!inv || !inv.ordered) continue;
        ordered++;
        if      (inv.testDone && inv.reportCollected)         doneWithReport++;
        else if (inv.testDone && !inv.reportCollected)        doneNoReport++;
        else if (inv.appointmentStatus === "MISSED")          missed++;
        else if (inv.appointmentStatus === "CANCELLED")       cancelled++;
        else if (inv.appointmentStatus === "SCHEDULED")       scheduled++;
        else                                                   pending++;
        if (inv.problemFlagged) problemFlagged++;
      }
      return {
        investigation: key,
        label,
        group: INV_GROUP_MAP[key] ?? "IMAGING",
        ordered, scheduled, doneWithReport, doneNoReport,
        missed, cancelled, pending, problemFlagged,
      };
    }).filter((item) => item.ordered > 0);

    // ── Activity Feed ────────────────────────────────────────────────────
    function getDateGroup(d: Date): DateGroup {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const scanDay = new Date(d); scanDay.setHours(0, 0, 0, 0);
      const diff = Math.floor((today.getTime() - scanDay.getTime()) / 86400000);
      if (diff === 0) return "TODAY";
      if (diff === 1) return "YESTERDAY";
      if (diff <= 7)  return "THIS_WEEK";
      return "EARLIER";
    }

    function getActivityType(pageNumber: number): ActivityType {
      if (pageNumber === 29) return "UPDATE";
      if (pageNumber >= 30 && pageNumber <= 36) return "UPDATE";
      if (pageNumber === 37 || pageNumber === 38) return "DOCTOR_ACTION";
      return "SUBMISSION";
    }

    function getPageLabel(pageNumber: number): string {
      if (pageNumber === 5 || pageNumber === 6) return "Investigation Summary";
      if (pageNumber >= 7 && pageNumber <= 28)  return `Investigation page ${pageNumber}`;
      if (pageNumber === 29) return "Treatment Plan";
      if (pageNumber >= 30 && pageNumber <= 36) return "NACT Tracking";
      if (pageNumber === 37) return "Radiation Booking";
      if (pageNumber === 38) return "Surgery Admission";
      return `Page ${pageNumber}`;
    }

    // Collect up to 30 most-recent scans across all patients
    const recentScans: Array<{
      id: string; patientId: string; patientName: string;
      uhid: string; pageNumber: number; scannedAt: Date;
    }> = [];
    for (const { patient, scans } of patientsWithScans) {
      for (const scan of scans) {
        recentScans.push({
          id: scan.id,
          patientId: patient.id,
          patientName: patient.fullName,
          uhid: patient.diaryId ?? patient.id,
          pageNumber: scan.pageNumber ?? 0,
          scannedAt: new Date(scan.scannedAt),
        });
      }
    }
    recentScans.sort((a, b) => b.scannedAt.getTime() - a.scannedAt.getTime());
    const activityFeed = recentScans.slice(0, 30).map((s) => ({
      id: s.id,
      patientName: s.patientName,
      patientId: s.patientId,
      uhid: s.uhid,
      action: `submitted ${getPageLabel(s.pageNumber)}`,
      detail: `Page ${s.pageNumber} — ${s.scannedAt.toLocaleDateString("en-IN")}`,
      type: getActivityType(s.pageNumber),
      timestamp: s.scannedAt.toISOString(),
      dateGroup: getDateGroup(s.scannedAt),
    }));

    // ── Upcoming Appointments ────────────────────────────────────────────
    // Show ALL investigations that have been scheduled but not yet done.
    // This includes:
    //   - SCHEDULED with a future date (genuinely upcoming)
    //   - SCHEDULED with a past date and testDone=false (overdue — patient hasn't shown up)
    //   - MISSED appointments (patient missed; may need rescheduling)
    // Does NOT include: COMPLETED, CANCELLED, NONE, or anything where testDone=true.

    const INV_LABEL_MAP: Record<string, string> = {};
    for (const inv of INVESTIGATIONS) INV_LABEL_MAP[inv.key] = inv.label;

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const upcomingAppointments: AnalyticsResponse["upcomingAppointments"] = [];
    for (const row of rows) {
      for (const [invKey, inv] of Object.entries(row.investigations)) {
        // Skip if no date recorded
        if (!inv.appointmentDate) continue;

        // Skip statuses we don't want to show
        if (
          inv.appointmentStatus === "CANCELLED" ||
          inv.appointmentStatus === "COMPLETED" ||
          inv.appointmentStatus === "NONE"
        ) continue;

        // Skip if already done (even if status not updated)
        if (inv.testDone) continue;

        const apptDate = new Date(inv.appointmentDate);
        if (isNaN(apptDate.getTime())) continue;

        // Normalise to midnight for day-diff calculation
        const apptDay = new Date(apptDate);
        apptDay.setHours(0, 0, 0, 0);
        const diffDays = Math.floor(
          (apptDay.getTime() - todayStart.getTime()) / 86400000
        );

        // Assign dateGroup:
        //   overdue (past) → TODAY (needs urgent follow-up)
        //   today          → TODAY
        //   tomorrow       → TOMORROW
        //   future         → THIS_WEEK
        const dateGroup: AppointmentDateGroup =
          diffDays <= 0 ? "TODAY" :
          diffDays === 1 ? "TOMORROW" :
          "THIS_WEEK";

        const status: AppointmentStatus =
          inv.appointmentStatus === "MISSED" ? "MISSED" : "SCHEDULED";

        upcomingAppointments.push({
          patientName: row.name,
          patientId: row.patientId,
          uhid: row.uhid,
          investigation: INV_LABEL_MAP[invKey] ?? invKey,
          appointmentDate: inv.appointmentDate,
          status,
          dateGroup,
        });
      }
    }

    // Sort: overdue/today first (oldest first), then upcoming by date ascending
    upcomingAppointments.sort(
      (a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime()
    );

    // Cap at 50 to avoid a huge payload
    const cappedAppointments = upcomingAppointments.slice(0, 50);

    return {
      kpi: {
        totalActivePatients: total,
        newInRange,
        updatesInRange,
        investigationCompletionRate,
        patientsNeedingAction,
        criticalSafetyFlags,
      },
      stageDistribution,
      investigationCompletion,
      treatmentBreakdown,
      activeIssues,
      genderDistribution,
      monthlyRegistrations,
      stageFunnel,
      investigationHeatmap,
      activityFeed,
      upcomingAppointments: cappedAppointments,
    };
  }

  async getCount(
    doctorId: string,
    filter: AdvancedAnalysisFilter,
    patientIds?: string[] | null
  ): Promise<number> {
    if (!doctorId) {
      throw new AppError(400, "Doctor ID is required");
    }

    const allPatients = await repo.findPatientsForDoctor(doctorId, patientIds ?? filter.patientIds);
    const dateFilteredPatients = applySubmissionDateFilter(allPatients, filter);
    const rows = dateFilteredPatients.map(({ patient, scans }) =>
      repo.mapToPatientAnalysisRow(patient, scans)
    );
    const filtered = repo.applyFilters(rows, filter);
    return applySearchFilter(filtered, filter.search).length;
  }
}

export const advancedAnalysisService = new AdvancedAnalysisService();
