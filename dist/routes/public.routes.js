"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const Patient_1 = require("../models/Patient");
const router = (0, express_1.Router)();
// ---------------------------------------------------------------------------
// Helper: decode & validate a TEMP_SESSION token from the Authorization header
// Returns the patientId on success, or sends an error response and returns null.
// ---------------------------------------------------------------------------
async function resolveSession(req, res) {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) {
        res.status(400).json({ success: false, message: "Session token is required in Authorization header" });
        return null;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        if (decoded.type !== "TEMP_SESSION") {
            res.status(401).json({ success: false, message: "Invalid session token" });
            return null;
        }
        const patient = await Patient_1.Patient.findByPk(decoded.patientId, {
            attributes: ["id", "status", "tokenVersion"],
        }).catch(() => null);
        if (!patient) {
            res.status(404).json({ success: false, message: "Patient not found" });
            return null;
        }
        if (patient.status === "INACTIVE") {
            res.status(401).json({ success: false, message: "Account deactivated. Please login again." });
            return null;
        }
        const decodedTokenVersion = Number.isInteger(decoded.tokenVersion)
            ? decoded.tokenVersion
            : 0;
        const currentTokenVersion = Number.isInteger(patient.tokenVersion)
            ? patient.tokenVersion
            : 0;
        if (decodedTokenVersion !== currentTokenVersion) {
            res.status(401).json({ success: false, message: "Session expired. Please login again." });
            return null;
        }
        return decoded.patientId;
    }
    catch {
        res.status(401).json({ success: false, message: "Session token is invalid or has expired" });
        return null;
    }
}
// ---------------------------------------------------------------------------
// POST /api/v1/public/patient-session
// Body: { diaryId: string }
// Creates a 10-minute session token for the patient.
// No auth required — the diaryId printed on the physical diary is the credential.
// ---------------------------------------------------------------------------
router.post("/patient-session", async (req, res) => {
    const { diaryId } = req.body;
    if (!diaryId || typeof diaryId !== "string" || !diaryId.trim()) {
        res.status(400).json({ success: false, message: "diaryId is required" });
        return;
    }
    const patient = await Patient_1.Patient.findOne({
        where: { diaryId: diaryId.trim() },
        attributes: ["id", "language", "status", "tokenVersion"],
    }).catch(() => null);
    if (!patient) {
        res.status(404).json({ success: false, message: "Patient not found" });
        return;
    }
    if (patient.status === "INACTIVE") {
        res.status(401).json({ success: false, message: "Account deactivated. Please login again." });
        return;
    }
    const sessionToken = jsonwebtoken_1.default.sign({
        type: "TEMP_SESSION",
        patientId: patient.id,
        tokenVersion: patient.tokenVersion ?? 0,
    }, process.env.JWT_SECRET, { expiresIn: "10m" });
    res.json({
        success: true,
        data: {
            sessionToken,
            expiresIn: 600,
            language: patient.language,
        },
    });
});
// ---------------------------------------------------------------------------
// GET /api/v1/public/patient-language
// Authorization: Bearer <sessionToken>
// Returns the current language of the patient identified by the session token.
// ---------------------------------------------------------------------------
router.get("/patient-language", async (req, res) => {
    const patientId = await resolveSession(req, res);
    if (!patientId)
        return;
    const patient = await Patient_1.Patient.findByPk(patientId, {
        attributes: ["language"],
    }).catch(() => null);
    if (!patient) {
        res.status(404).json({ success: false, message: "Patient not found" });
        return;
    }
    res.json({ success: true, data: { language: patient.language } });
});
// ---------------------------------------------------------------------------
// PATCH /api/v1/public/patient-language
// Authorization: Bearer <sessionToken>
// Body: { language: "en" | "hi" }
// Updates the patient's language preference.
// ---------------------------------------------------------------------------
router.patch("/patient-language", async (req, res) => {
    const patientId = await resolveSession(req, res);
    if (!patientId)
        return;
    const { language } = req.body;
    if (!language || !["en", "hi"].includes(language)) {
        res.status(400).json({ success: false, message: "Invalid language. Supported values: en, hi" });
        return;
    }
    const patient = await Patient_1.Patient.findByPk(patientId).catch(() => null);
    if (!patient) {
        res.status(404).json({ success: false, message: "Patient not found" });
        return;
    }
    patient.language = language;
    await patient.save();
    res.json({
        success: true,
        message: "Language updated successfully",
        data: { language: patient.language },
    });
});
exports.default = router;
