import express from "express";
import { Patient } from "../models/Patient";
import { AuthenticatedRequest } from "../middleware/authMiddleware";


const userVisitCounters = new Map();
const WELCOME_LIMIT = 6;

/**
 * Get patientId using token from DB
 */
const getPatientIdFromRequest = async (req: AuthenticatedRequest) => {
  const patientId = req.user.id;

  if (!patientId) return "";

  const patient = await Patient.findByPk(patientId, {
    attributes: ["id"],
    paranoid: false,
  });

  return patient?.id ? String(patient.id) : "";
};

const getCurrentCounter = (patientId: string) =>
  userVisitCounters.get(patientId) ?? 0;

const saveNextCounter = (patientId: string, currentCounter: number) => {
  userVisitCounters.set(patientId, currentCounter + 1);
};

export const welcomeUser = async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const patientId = await getPatientIdFromRequest(req);

    if (!patientId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token or patient not found",
      });
    }

    const currentCounter = getCurrentCounter(patientId);
    const shouldShowWelcome = currentCounter < WELCOME_LIMIT;

    saveNextCounter(patientId, currentCounter);

    return res.status(200).json({
      success: shouldShowWelcome,
      message: shouldShowWelcome ? "Welcome to the Platform" : null,
      counter: currentCounter,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};