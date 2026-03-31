import { google } from "googleapis";
import {
  AdvancedAnalysisFilter,
  INVESTIGATIONS,
  PatientAnalysisRow,
} from "./advancedAnalysisTypes";
import { AdvancedAnalysisRepository } from "../repositories/advancedAnalysisRepository";

// ── Auth ──────────────────────────────────────────────────────────────────

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      "Google service account credentials not configured. " +
        "Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env"
    );
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: rawKey.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

// ── Data formatters ───────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN");
}

function fmtBool(v: boolean): string {
  return v ? "Yes" : "No";
}

function fmtInvStatus(inv: PatientAnalysisRow["investigations"][string]): string {
  if (!inv.ordered) return "Not Ordered";
  if (inv.testDone && inv.reportCollected) return "Done + Report";
  if (inv.testDone && !inv.reportCollected) return "Done / No Report";
  if (inv.appointmentStatus !== "NONE") return inv.appointmentStatus;
  return "Ordered";
}

// ── Build sheet data ──────────────────────────────────────────────────────

function buildPatientRows(patients: PatientAnalysisRow[]): string[][] {
  // Header row
  const headers: string[] = [
    "Name", "UHID", "Age", "Sex", "Stage", "Issues", "Last Activity",
  ];
  for (const inv of INVESTIGATIONS) {
    headers.push(`${inv.label} — Status`, `${inv.label} — Appt Date`, `${inv.label} — Problem`);
  }
  headers.push(
    "NACT Planned", "Surgery Type", "Radiotherapy", "Treatment Not Decided",
    "NACT Status", "NACT Start Date", "Last Cycle Date",
    "Clips — Breast", "Clips — Axilla",
    "Tumor Growing on Chemo", "Unable to Complete Chemo", "Chemo Started Clips Missing",
    "Admission Date", "Admission Status", "Radiation Date", "Radiation Status",
  );

  const rows: string[][] = [headers];

  for (const p of patients) {
    const row: string[] = [
      p.name,
      p.uhid,
      String(p.age),
      p.sex,
      p.currentStage.replace(/_/g, " "),
      p.issues.join(", ") || "None",
      fmtDate(p.lastActivityDate),
    ];

    for (const inv of INVESTIGATIONS) {
      const d = p.investigations[inv.key];
      row.push(
        d ? fmtInvStatus(d) : "Not Ordered",
        d ? fmtDate(d.appointmentDate) : "",
        d ? fmtBool(d.problemFlagged) : "No"
      );
    }

    row.push(
      fmtBool(p.treatmentPlan.nact),
      p.treatmentPlan.surgeryType ?? "Not Planned",
      fmtBool(p.treatmentPlan.radiotherapy),
      fmtBool(p.treatmentPlan.notDecidedYet),
      p.nact.status.replace(/_/g, " "),
      fmtDate(p.nact.startDate),
      fmtDate(p.nact.lastCycleDate),
      fmtBool(p.nact.clipsBreast),
      fmtBool(p.nact.clipsAxilla),
      fmtBool(p.nact.tumorGrowing),
      fmtBool(p.nact.unableToComplete),
      fmtBool(p.nact.chemoStartedClipsMissing),
      fmtDate(p.surgery.admissionDate),
      p.surgery.admissionStatus ?? "",
      fmtDate(p.surgery.radiationDate),
      p.surgery.radiationStatus ?? "",
    );

    rows.push(row);
  }

  return rows;
}

function buildFilterRows(filter: AdvancedAnalysisFilter, total: number): string[][] {
  const rows: string[][] = [
    ["Field", "Value"],
    ["Synced At", new Date().toLocaleString("en-IN")],
    ["Total Patients Exported", String(total)],
    [""],
    ["— Active Filters —", ""],
    ["Sex", filter.sex],
    ["Age Min", filter.ageMin != null ? String(filter.ageMin) : "—"],
    ["Age Max", filter.ageMax != null ? String(filter.ageMax) : "—"],
    ["NACT Planned", filter.nactPlanned],
    ["Surgery Type", filter.surgeryType],
    ["Radiotherapy Planned", filter.radiotherapyPlanned],
    ["Treatment Not Decided", filter.treatmentNotDecided],
    ["NACT Status", filter.nactStatus],
    ["Clips — Breast", filter.clipsBreast],
    ["Clips — Axilla", filter.clipsAxilla],
    ["Tumor Growing on Chemo", filter.tumorGrowingOnChemo],
    ["Unable to Complete Chemo", filter.unableToCompleteChemo],
    ["Chemo Started Clips Missing", filter.chemoStartedClipsMissing],
    ["Radiation Booked", filter.radiationBooked],
    ["Surgery Admission", filter.surgeryAdmission],
  ];

  // Active investigation filters
  const activeInvFilters = Object.entries(filter.investigations ?? {}).filter(
    ([, v]) => v !== "ANY"
  );
  if (activeInvFilters.length > 0) {
    rows.push([""], ["— Investigation Filters —", ""]);
    for (const [key, val] of activeInvFilters) {
      const label = INVESTIGATIONS.find((i) => i.key === key)?.label ?? key;
      rows.push([label, val]);
    }
  }

  return rows;
}

// ── Formatting requests ───────────────────────────────────────────────────

function makeHeaderFormatRequests(sheetId: number, colCount: number) {
  return [
    // Freeze row 1
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    // Bold + teal background on header row
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: colCount },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0, green: 0.47, blue: 0.53 },    // #007787
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
      },
    },
    // Auto-resize all columns
    {
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: colCount },
      },
    },
  ];
}

// ── Fetch all patients (no pagination) ───────────────────────────────────

async function fetchAllPatients(
  doctorId: string,
  filter: AdvancedAnalysisFilter
): Promise<PatientAnalysisRow[]> {
  const repo = new AdvancedAnalysisRepository();
  const all = await repo.findPatientsForDoctor(doctorId);
  const rows = all.map(({ patient, scans }) =>
    repo.mapToPatientAnalysisRow(patient, scans)
  );
  const filtered = repo.applyFilters(rows, filter);
  return repo.applySorting(filtered, filter.sortBy);
}

// ── Public service ────────────────────────────────────────────────────────

export class GoogleSheetsService {
  /**
   * Creates a new Google Sheet (first sync) or updates an existing one.
   * Returns { sheetId, sheetUrl }.
   */
  async syncAnalyticsSheet(
    doctorId: string,
    filter: AdvancedAnalysisFilter,
    existingSheetId?: string
  ): Promise<{ sheetId: string; sheetUrl: string }> {
    const auth = getAuth();
    const sheetsApi = google.sheets({ version: "v4", auth });
    const driveApi = google.drive({ version: "v3", auth });

    const patients = await fetchAllPatients(doctorId, filter);
    const patientRows = buildPatientRows(patients);
    const filterRows = buildFilterRows(filter, patients.length);

    let sheetId: string;

    if (existingSheetId) {
      // ── Update mode: clear and rewrite both sheets ──────────────────
      sheetId = existingSheetId;

      await sheetsApi.spreadsheets.values.batchClear({
        spreadsheetId: sheetId,
        requestBody: { ranges: ["Patients", "Active Filters"] },
      });

      await sheetsApi.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: [
            { range: "Patients!A1", values: patientRows },
            { range: "Active Filters!A1", values: filterRows },
          ],
        },
      });

      // Re-apply header formatting after data is refreshed
      const meta = await sheetsApi.spreadsheets.get({ spreadsheetId: sheetId });
      const patientsSheet = meta.data.sheets?.find(
        (s) => s.properties?.title === "Patients"
      );
      if (patientsSheet?.properties?.sheetId != null) {
        await sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: makeHeaderFormatRequests(
              patientsSheet.properties.sheetId,
              patientRows[0].length
            ),
          },
        });
      }
    } else {
      // ── Create mode ─────────────────────────────────────────────────
      const created = await sheetsApi.spreadsheets.create({
        requestBody: {
          properties: {
            title: `OneHeal Analytics — ${new Date().toLocaleDateString("en-IN")}`,
          },
          sheets: [
            { properties: { title: "Patients", index: 0 } },
            { properties: { title: "Active Filters", index: 1 } },
          ],
        },
      });

      sheetId = created.data.spreadsheetId!;
      const createdSheets = created.data.sheets ?? [];
      const patientsSheetId = createdSheets[0]?.properties?.sheetId ?? 0;

      // Write data to both sheets
      await sheetsApi.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: [
            { range: "Patients!A1", values: patientRows },
            { range: "Active Filters!A1", values: filterRows },
          ],
        },
      });

      // Format: freeze row, bold header, auto-resize
      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: makeHeaderFormatRequests(patientsSheetId, patientRows[0].length),
        },
      });

      // Share: anyone with the link can view
      await driveApi.permissions.create({
        fileId: sheetId,
        requestBody: { type: "anyone", role: "reader" },
      });
    }

    return {
      sheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`,
    };
  }
}

export const googleSheetsService = new GoogleSheetsService();
