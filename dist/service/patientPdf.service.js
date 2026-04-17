"use strict";
/**
 * patientPdf.service.ts
 *
 * Generates a patient health report PDF using PDFKit, uploads it to S3, and
 * returns the public S3 URL.
 *
 * The layout exactly mirrors the jsPDF implementation in PatientPortal.tsx:
 *   Cover page → Personal Info → Current Doctor → Doctor History →
 *   Subscription → Prescribed Tests → Appointments → Diary Pages
 *
 * PDFKit works in points (1 pt = 1/72 inch).  A4 = 595.28 × 841.89 pt.
 * The frontend uses mm with 1 mm ≈ 2.8346 pt — all measurements below are
 * converted accordingly so proportions are identical.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAndUploadPatientPDF = exports.buildPatientPDF = void 0;
const pdfkit_1 = __importDefault(require("pdfkit"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const s3Upload_1 = require("../utils/s3Upload");
// ── Constants (mirrors frontend) ─────────────────────────────────────────────
// Frontend unit: mm → multiply by 2.8346 to get pt
const MM = 2.8346;
const PW = 210 * MM; // A4 width  595 pt
const PH = 297 * MM; // A4 height 842 pt
const M = 16 * MM; // margin
const CW = (210 - 16 * 2) * MM; // content width
// Brand colours  [R, G, B] 0–255
const BRAND = { r: 0, g: 119, b: 135 };
const DARK = { r: 14, g: 47, b: 90 };
const GRAY = { r: 100, g: 116, b: 139 };
const LIGHT = { r: 241, g: 245, b: 249 };
const WHITE = { r: 255, g: 255, b: 255 };
const DARK_TEXT = { r: 30, g: 30, b: 30 };
const LOGO_PATH = path_1.default.resolve(__dirname, "../assets/canTRAC-Logo.png");
const FOOTER_BOTTOM = PH - 20; // footer sits 20 pt above page bottom
const PAGE_CONTENT_BOTTOM = PH - 40; // guard threshold (matches frontend's PH - 18 mm)
// ── Date helpers ─────────────────────────────────────────────────────────────
function fmtDate(d) {
    if (!d)
        return "\u2014";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(d) {
    if (!d)
        return "\u2014";
    const dt = new Date(d);
    return dt.toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}
function clip(text, maxChars) {
    const s = String(text ?? "\u2014");
    return s.length > maxChars ? s.slice(0, maxChars - 1) + "\u2026" : s;
}
// ── PDF builder ───────────────────────────────────────────────────────────────
async function buildPatientPDF(data) {
    return new Promise((resolve, reject) => {
        const doc = new pdfkit_1.default({
            size: "A4",
            margin: 0,
            bufferPages: true,
            info: {
                Title: "Patient Health Report",
                Author: "CanTRAC by OneHeal Technologies",
                Subject: `Health report for ${data.patient.fullName}`,
            },
        });
        const chunks = [];
        doc.on("data", (c) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
        let pageNum = 1;
        let curY = 0;
        // ── helpers ─────────────────────────────────────────────────────────
        const rgb = (c) => doc.fillColor([c.r, c.g, c.b]).strokeColor([c.r, c.g, c.b]);
        const guard = (neededPt) => {
            if (curY + neededPt > PAGE_CONTENT_BOTTOM) {
                addFooter();
                doc.addPage();
                pageNum++;
                curY = M;
            }
        };
        const addFooter = () => {
            const savedY = curY;
            const footerY = PH - 18;
            if (fs_1.default.existsSync(LOGO_PATH)) {
                doc.image(LOGO_PATH, M, footerY - 10, { width: 14, height: 14 });
            }
            doc
                .fillColor([GRAY.r, GRAY.g, GRAY.b])
                .fontSize(7)
                .font("Helvetica")
                .text("CanTRAC by OneHeal Technologies \u2014 Confidential Patient Health Record", M + 18, footerY - 4, { lineBreak: false })
                .text(`Page ${pageNum}`, PW - M - 40, footerY - 4, { width: 40, align: "right", lineBreak: false });
            curY = savedY;
        };
        // ── section header: teal rounded rect with white text ────────────────
        const sectionHead = (title) => {
            guard(20 * MM);
            const h = 8 * MM;
            const rCorner = 1.5 * MM;
            doc
                .roundedRect(M, curY, CW, h, rCorner)
                .fillColor([BRAND.r, BRAND.g, BRAND.b])
                .fill();
            doc
                .fillColor([WHITE.r, WHITE.g, WHITE.b])
                .fontSize(9.5)
                .font("Helvetica-Bold")
                .text(title, M + 4 * MM, curY + 3.5 * MM, { lineBreak: false });
            curY += h + 3 * MM;
        };
        // ── two-column key:value row ─────────────────────────────────────────
        const row = (label, value, col2) => {
            guard(7 * MM);
            const half = CW / 2;
            const labelW = 36 * MM;
            doc.fontSize(8).font("Helvetica-Bold").fillColor([DARK.r, DARK.g, DARK.b])
                .text(label, M, curY, { lineBreak: false, width: labelW });
            doc.fontSize(8).font("Helvetica").fillColor([DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b])
                .text(clip(value, col2 ? 28 : 55), M + labelW, curY, { lineBreak: false, width: col2 ? half - labelW : CW - labelW });
            if (col2) {
                const cx = M + half;
                doc.fontSize(8).font("Helvetica-Bold").fillColor([DARK.r, DARK.g, DARK.b])
                    .text(col2.label, cx, curY, { lineBreak: false, width: labelW });
                doc.fontSize(8).font("Helvetica").fillColor([DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b])
                    .text(clip(col2.value, 28), cx + labelW, curY, { lineBreak: false, width: half - labelW });
            }
            curY += 6.5 * MM;
        };
        const tableHead = (cols) => {
            guard(9 * MM);
            const h = 7 * MM;
            doc.rect(M, curY, CW, h)
                .fillColor([LIGHT.r, LIGHT.g, LIGHT.b]).fill();
            doc.fontSize(7.5).font("Helvetica-Bold").fillColor([DARK.r, DARK.g, DARK.b]);
            cols.forEach(c => {
                doc.text(c.label, M + c.x * MM, curY + 3 * MM, { lineBreak: false, width: c.w * MM });
            });
            curY += h + MM;
        };
        const tableRow = (cells, isOdd) => {
            guard(7 * MM);
            if (isOdd) {
                doc.rect(M, curY - MM, CW, 7 * MM)
                    .fillColor([248, 250, 252]).fill();
            }
            doc.fontSize(7.5).font("Helvetica").fillColor([DARK_TEXT.r, DARK_TEXT.g, DARK_TEXT.b]);
            cells.forEach(c => {
                doc.text(clip(c.text, Math.floor(c.w / 2.2)), M + c.x * MM, curY + 2 * MM, { lineBreak: false, width: c.w * MM });
            });
            curY += 7 * MM;
        };
        // ── plain text helper for sections without data ──────────────────────
        const grayText = (text) => {
            guard(7 * MM);
            doc.fontSize(8.5).font("Helvetica").fillColor([GRAY.r, GRAY.g, GRAY.b])
                .text(text, M, curY, { lineBreak: false });
            curY += 7 * MM;
        };
        // ════════════════════════════════════════════════════════════════════
        // COVER PAGE
        // ════════════════════════════════════════════════════════════════════
        // Teal header band (55 mm high)
        doc.rect(0, 0, PW, 55 * MM).fillColor([BRAND.r, BRAND.g, BRAND.b]).fill();
        // Logo
        if (fs_1.default.existsSync(LOGO_PATH)) {
            doc.image(LOGO_PATH, M, 10 * MM, { width: 14 * MM, height: 14 * MM });
        }
        // Title
        doc.fontSize(22).font("Helvetica-Bold").fillColor([WHITE.r, WHITE.g, WHITE.b])
            .text("Patient Health Report", M + 18 * MM, 10 * MM, { lineBreak: false });
        doc.fontSize(10).font("Helvetica").fillColor([200, 240, 244])
            .text("Complete Medical Data Export \u2014 CanTRAC by OneHeal Technologies", M + 18 * MM, 20 * MM, { lineBreak: false });
        doc.fillColor([180, 230, 238])
            .text(`Generated: ${fmtDateTime(data.exportedAt || new Date().toISOString())}`, M + 18 * MM, 28 * MM, { lineBreak: false });
        // Dark patient name bar
        doc.rect(0, 52 * MM, PW, 14 * MM).fillColor([DARK.r, DARK.g, DARK.b]).fill();
        doc.fontSize(13).font("Helvetica-Bold").fillColor([WHITE.r, WHITE.g, WHITE.b])
            .text(data.patient.fullName, M, 56 * MM, { lineBreak: false });
        const subLine = [
            `Diary ID: ${data.patient.diaryId || "\u2014"}`,
            `Case: ${(data.patient.caseType || "").replace(/_/g, " ")}`,
            `Status: ${data.patient.status || "\u2014"}`,
        ].join("   \u00B7   ");
        doc.fontSize(9).font("Helvetica").fillColor([180, 200, 220])
            .text(subLine, M, 62 * MM, { lineBreak: false });
        curY = 76 * MM;
        // ════════════════════════════════════════════════════════════════════
        // 1. PERSONAL INFORMATION
        // ════════════════════════════════════════════════════════════════════
        sectionHead("1. Personal Information");
        const p = data.patient;
        row("Full Name:", p.fullName, { label: "Diary ID:", value: p.diaryId || "\u2014" });
        row("Age:", String(p.age || "\u2014"), { label: "Gender:", value: p.gender || "\u2014" });
        row("Phone:", p.phone || "\u2014", { label: "Case Type:", value: (p.caseType || "").replace(/_/g, " ") });
        row("Status:", p.status || "\u2014", { label: "Stage:", value: p.stage || "\u2014" });
        if (p.address)
            row("Address:", p.address);
        if (p.treatmentPlan)
            row("Treatment:", p.treatmentPlan);
        row("Registered:", fmtDate(p.registeredDate), { label: "Last Scan:", value: fmtDate(p.lastDiaryScan) });
        curY += 3 * MM;
        // ════════════════════════════════════════════════════════════════════
        // 2. CURRENT DOCTOR
        // ════════════════════════════════════════════════════════════════════
        sectionHead("2. Current Assigned Doctor");
        if (p.doctor) {
            row("Doctor:", p.doctor.fullName || "\u2014", { label: "License:", value: p.doctor.license || "\u2014" });
            row("Specialization:", p.doctor.specialization || "\u2014", { label: "Hospital:", value: p.doctor.hospital || "\u2014" });
            row("Phone:", p.doctor.phone || "\u2014", { label: "Email:", value: p.doctor.email || "\u2014" });
        }
        else {
            grayText("No doctor currently assigned.");
        }
        curY += 3 * MM;
        // ════════════════════════════════════════════════════════════════════
        // 3. DOCTOR HISTORY
        // ════════════════════════════════════════════════════════════════════
        sectionHead("3. Doctor History");
        const history = data.doctorHistory || [];
        if (history.length === 0) {
            grayText("No doctor assignment history available.");
        }
        else {
            tableHead([
                { label: "#", x: 0, w: 8 },
                { label: "Doctor Name", x: 8, w: 50 },
                { label: "Specialization", x: 58, w: 45 },
                { label: "Hospital", x: 103, w: 40 },
                { label: "Assigned", x: 143, w: 28 },
                { label: "Until", x: 171, w: 28 },
            ]);
            history.forEach((h, i) => {
                tableRow([
                    { text: String(i + 1), x: 0, w: 8 },
                    { text: h.doctor?.fullName || "\u2014", x: 8, w: 50 },
                    { text: h.doctor?.specialization || "\u2014", x: 58, w: 45 },
                    { text: h.doctor?.hospital || "\u2014", x: 103, w: 40 },
                    { text: fmtDate(h.assignedAt), x: 143, w: 28 },
                    { text: h.isCurrent ? "Current" : fmtDate(h.unassignedAt || ""), x: 171, w: 28 },
                ], i % 2 === 0);
            });
        }
        curY += 3 * MM;
        // ════════════════════════════════════════════════════════════════════
        // 4. SUBSCRIPTION
        // ════════════════════════════════════════════════════════════════════
        sectionHead("4. Subscription");
        const sub = data.subscription;
        if (sub) {
            const pagesLabel = sub.maxDiaryPages === -1 ? "Unlimited" : String(sub.maxDiaryPages ?? "\u2014");
            row("Plan:", sub.planName || "\u2014", { label: "Status:", value: sub.status || "\u2014" });
            row("Pages Used:", `${sub.pagesUsed ?? 0} / ${pagesLabel}`, { label: "Paid:", value: sub.paidAmount ? `\u20B9${sub.paidAmount}` : "\u2014" });
            row("Start Date:", fmtDate(sub.startDate), { label: "End Date:", value: fmtDate(sub.endDate) });
            row("Scan:", sub.scanEnabled ? "Enabled" : "Disabled", { label: "Manual Entry:", value: sub.manualEntryEnabled ? "Enabled" : "Disabled" });
        }
        else {
            grayText("No active subscription.");
        }
        curY += 3 * MM;
        // ════════════════════════════════════════════════════════════════════
        // 5. PRESCRIBED TESTS
        // ════════════════════════════════════════════════════════════════════
        const tests = p.prescribedTests || [];
        if (tests.length > 0) {
            sectionHead("5. Prescribed Tests");
            tableHead([
                { label: "Test Name", x: 0, w: 80 },
                { label: "Completed", x: 80, w: 28 },
                { label: "Report Received", x: 108, w: 36 },
                { label: "Date", x: 144, w: 34 },
            ]);
            tests.forEach((t, i) => {
                tableRow([
                    { text: t.name || "\u2014", x: 0, w: 80 },
                    { text: t.completed ? "Yes" : "No", x: 80, w: 28 },
                    { text: t.reportReceived ? "Yes" : "No", x: 108, w: 36 },
                    { text: fmtDate(t.completedDate), x: 144, w: 34 },
                ], i % 2 === 0);
            });
            row("Completion Rate:", `${p.testCompletionPercentage ?? 0}%`, {
                label: "Total Tests:",
                value: String(p.totalTestsPrescribed ?? tests.length),
            });
            curY += 3 * MM;
        }
        // ════════════════════════════════════════════════════════════════════
        // 6. APPOINTMENTS & REMINDERS
        // ════════════════════════════════════════════════════════════════════
        const reminders = data.reminders || [];
        if (reminders.length > 0) {
            sectionHead("6. Appointments & Reminders");
            tableHead([
                { label: "Date & Time", x: 0, w: 42 },
                { label: "Type", x: 42, w: 36 },
                { label: "Status", x: 78, w: 22 },
                { label: "Message", x: 100, w: 79 },
            ]);
            reminders.forEach((r, i) => {
                tableRow([
                    { text: fmtDateTime(r.reminderDate), x: 0, w: 42 },
                    { text: (r.type || "\u2014").replace(/_/g, " "), x: 42, w: 36 },
                    { text: r.status || "\u2014", x: 78, w: 22 },
                    { text: r.message || "\u2014", x: 100, w: 79 },
                ], i % 2 === 0);
            });
            curY += 3 * MM;
        }
        // ════════════════════════════════════════════════════════════════════
        // 7. DIARY PAGES — full Q&A per page
        // ════════════════════════════════════════════════════════════════════
        const scanResults = data.scanResults || [];
        if (scanResults.length > 0) {
            sectionHead("7. Diary Pages \u2014 Answers & Submissions");
            const sorted = [...scanResults].sort((a, b) => {
                if (a.pageNumber == null && b.pageNumber == null)
                    return 0;
                if (a.pageNumber == null)
                    return 1;
                if (b.pageNumber == null)
                    return -1;
                return a.pageNumber - b.pageNumber;
            });
            sorted.forEach((s, idx) => {
                // Per-page header strip
                guard(12 * MM);
                const stripH = 9 * MM;
                doc.rect(M, curY, CW, stripH).fillColor([230, 237, 245]).fill();
                const pageLabel = s.pageNumber != null ? `Page ${s.pageNumber}` : s.pageId || `Entry ${idx + 1}`;
                const methodLabel = (s.submissionType || "")
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, l => l.toUpperCase());
                doc.fontSize(9).font("Helvetica-Bold").fillColor([DARK.r, DARK.g, DARK.b])
                    .text(`${pageLabel}  \u00B7  ${s.pageType || ""}`, M + 3 * MM, curY + 2.5 * MM, { lineBreak: false });
                const metaText = `Submitted: ${fmtDateTime(s.createdAt)}   Method: ${methodLabel}   Reviewed: ${s.doctorReviewed ? "Yes" : "No"}`;
                doc.fontSize(7.5).font("Helvetica").fillColor([GRAY.r, GRAY.g, GRAY.b])
                    .text(metaText, M, curY + 4.5 * MM, { width: CW - 3 * MM, align: "right", lineBreak: false });
                curY += stripH + 2 * MM;
                // Answers
                const answers = s.scanResults ? Object.values(s.scanResults) : [];
                if (answers.length > 0) {
                    guard(7 * MM);
                    doc.fontSize(7.5).font("Helvetica-Bold").fillColor([BRAND.r, BRAND.g, BRAND.b])
                        .text("Answers:", M + 2 * MM, curY, { lineBreak: false });
                    curY += 5.5 * MM;
                    answers.forEach((ans) => {
                        guard(6 * MM);
                        const qText = ans.questionText || ans.questionId || "\u2014";
                        const aText = ans.answer != null ? String(ans.answer) : "\u2014";
                        const colW = CW * 0.55;
                        doc.fontSize(7.5).font("Helvetica").fillColor([60, 60, 60])
                            .text(clip(`Q: ${qText}`, 60), M + 4 * MM, curY, { lineBreak: false, width: colW - 4 * MM });
                        doc.text(clip(`A: ${aText}`, 30), M + CW * 0.58, curY, { lineBreak: false, width: CW * 0.4 });
                        curY += 5.5 * MM;
                    });
                }
                // Doctor overrides
                if (s.doctorOverrides && Object.keys(s.doctorOverrides).length > 0) {
                    guard(7 * MM);
                    doc.fontSize(7.5).font("Helvetica-Bold").fillColor([DARK.r, DARK.g, DARK.b])
                        .text("Doctor Corrections:", M + 2 * MM, curY, { lineBreak: false });
                    curY += 5.5 * MM;
                    Object.entries(s.doctorOverrides).forEach(([qId, val]) => {
                        guard(5.5 * MM);
                        doc.fontSize(7.5).font("Helvetica").fillColor([60, 60, 60])
                            .text(`${qId}: ${val}`, M + 6 * MM, curY, { lineBreak: false });
                        curY += 5.5 * MM;
                    });
                }
                // Doctor notes
                if (s.doctorNotes) {
                    guard(8 * MM);
                    doc.fontSize(7.5).font("Helvetica-Bold").fillColor([DARK.r, DARK.g, DARK.b])
                        .text("Doctor Notes:", M + 2 * MM, curY, { lineBreak: false });
                    curY += 5 * MM;
                    const noteLines = s.doctorNotes.match(/.{1,80}/g) || [s.doctorNotes];
                    noteLines.slice(0, 4).forEach(line => {
                        guard(5.5 * MM);
                        doc.fontSize(7.5).font("Helvetica-Oblique").fillColor([60, 60, 60])
                            .text(line, M + 6 * MM, curY, { lineBreak: false });
                        curY += 5.5 * MM;
                    });
                }
                // Report files
                const reportFiles = Array.isArray(s.reportFiles)
                    ? s.reportFiles
                    : Array.isArray(s.reportUrls)
                        ? s.reportUrls.map((url) => ({ url, name: url.split("/").pop() || "Uploaded file" }))
                        : [];
                if (reportFiles.length > 0) {
                    guard(7 * MM);
                    doc.fontSize(7.5).font("Helvetica-Bold").fillColor([DARK.r, DARK.g, DARK.b])
                        .text(`Report Files (${reportFiles.length}):`, M + 2 * MM, curY, { lineBreak: false });
                    curY += 5 * MM;
                    reportFiles.slice(0, 3).forEach((file, ui) => {
                        guard(5.5 * MM);
                        const fname = file.name || `Report ${ui + 1}`;
                        doc.fontSize(7.5).font("Helvetica").fillColor([0, 100, 200])
                            .text(`\u2022 ${fname}`, M + 6 * MM, curY, { lineBreak: false });
                        curY += 5.5 * MM;
                    });
                    if (reportFiles.length > 3) {
                        guard(5.5 * MM);
                        doc.fillColor([GRAY.r, GRAY.g, GRAY.b])
                            .text(`  \u2026and ${reportFiles.length - 3} more files`, M + 6 * MM, curY, { lineBreak: false });
                        curY += 5.5 * MM;
                    }
                }
                // Dashed separator between pages
                guard(4 * MM);
                doc.dash(3, { space: 3 })
                    .moveTo(M, curY)
                    .lineTo(M + CW, curY)
                    .strokeColor([210, 220, 230])
                    .stroke()
                    .undash();
                curY += 5 * MM;
            });
        }
        // ════════════════════════════════════════════════════════════════════
        // CLOSING BAND
        // ════════════════════════════════════════════════════════════════════
        guard(18 * MM);
        doc.rect(M, curY, CW, 14 * MM).fillColor([LIGHT.r, LIGHT.g, LIGHT.b]).fill();
        if (fs_1.default.existsSync(LOGO_PATH)) {
            doc.image(LOGO_PATH, M + 3 * MM, curY + 3 * MM, { width: 8 * MM, height: 8 * MM });
        }
        doc.fontSize(9).font("Helvetica-Bold").fillColor([DARK.r, DARK.g, DARK.b])
            .text("CanTRAC by OneHeal Technologies", M + 14 * MM, curY + 4 * MM, { lineBreak: false });
        doc.fontSize(7.5).font("Helvetica").fillColor([GRAY.r, GRAY.g, GRAY.b])
            .text("This document contains confidential patient health information. Keep it secure.", M, curY + 9 * MM, { width: CW, align: "center", lineBreak: false });
        // Stamp footer on all pages
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
            doc.switchToPage(i);
            const fp = PH - 18;
            if (fs_1.default.existsSync(LOGO_PATH)) {
                doc.image(LOGO_PATH, M, fp - 8, { width: 12, height: 12 });
            }
            doc.fontSize(7).font("Helvetica").fillColor([GRAY.r, GRAY.g, GRAY.b])
                .text("CanTRAC by OneHeal Technologies \u2014 Confidential Patient Health Record", M + 16, fp - 2, { lineBreak: false })
                .text(`Page ${i + 1} / ${totalPages}`, PW - M - 50, fp - 2, { width: 50, align: "right", lineBreak: false });
        }
        doc.end();
    });
}
exports.buildPatientPDF = buildPatientPDF;
// ── Main export: generate + upload ───────────────────────────────────────────
async function generateAndUploadPatientPDF(data, patientId, diaryId) {
    const pdfBuffer = await buildPatientPDF(data);
    const label = diaryId || patientId.slice(0, 8);
    const date = new Date().toISOString().slice(0, 10);
    const s3Key = `patient-exports/${patientId}/CanTRAC-${label}-${date}-${Date.now()}.pdf`;
    const url = await (0, s3Upload_1.uploadBufferToS3)(pdfBuffer, "application/pdf", s3Key);
    return url;
}
exports.generateAndUploadPatientPDF = generateAndUploadPatientPDF;
