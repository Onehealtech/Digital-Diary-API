import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Patient } from "../models/Patient";

const router = Router();

// ---------------------------------------------------------------------------
// Helper: decode & validate a TEMP_SESSION token from the Authorization header
// Returns the patientId on success, or sends an error response and returns null.
// ---------------------------------------------------------------------------
async function resolveSession(
  req: Request,
  res: Response
): Promise<string | null> {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    res.status(400).json({ success: false, message: "Session token is required in Authorization header" });
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      type: string;
      patientId: string;
    };

    if (decoded.type !== "TEMP_SESSION") {
      res.status(401).json({ success: false, message: "Invalid session token" });
      return null;
    }

    return decoded.patientId;
  } catch {
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
router.post("/patient-session", async (req: Request, res: Response) => {
  const { diaryId } = req.body;

  if (!diaryId || typeof diaryId !== "string" || !diaryId.trim()) {
    res.status(400).json({ success: false, message: "diaryId is required" });
    return;
  }

  const patient = await Patient.findOne({
    where: { diaryId: diaryId.trim() },
    attributes: ["id", "language"],
  }).catch(() => null);

  if (!patient) {
    res.status(404).json({ success: false, message: "Patient not found" });
    return;
  }

  const sessionToken = jwt.sign(
    { type: "TEMP_SESSION", patientId: patient.id },
    process.env.JWT_SECRET!,
    { expiresIn: "10m" }
  );

  res.json({
    success: true,
    data: {
      sessionToken,
      expiresIn: 600, // seconds
      language: patient.language,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/public/patient-language
// Authorization: Bearer <sessionToken>
// Returns the current language of the patient identified by the session token.
// ---------------------------------------------------------------------------
router.get("/patient-language", async (req: Request, res: Response) => {
  const patientId = await resolveSession(req, res);
  if (!patientId) return;

  const patient = await Patient.findByPk(patientId, {
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
router.patch("/patient-language", async (req: Request, res: Response) => {
  const patientId = await resolveSession(req, res);
  if (!patientId) return;

  const { language } = req.body;

  if (!language || !["en", "hi"].includes(language)) {
    res.status(400).json({ success: false, message: "Invalid language. Supported values: en, hi" });
    return;
  }

  const patient = await Patient.findByPk(patientId).catch(() => null);

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

export default router;
