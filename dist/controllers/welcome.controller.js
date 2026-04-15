"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.welcomeUser = void 0;
const Patient_1 = require("../models/Patient");
const userVisitCounters = new Map();
const WELCOME_LIMIT = 6;
/**
 * Get patientId using token from DB
 */
const getPatientIdFromRequest = async (req) => {
    const patientId = req.user.id;
    if (!patientId)
        return "";
    const patient = await Patient_1.Patient.findByPk(patientId, {
        attributes: ["id"],
        paranoid: false,
    });
    return patient?.id ? String(patient.id) : "";
};
const getCurrentCounter = (patientId) => userVisitCounters.get(patientId) ?? 0;
const saveNextCounter = (patientId, currentCounter) => {
    userVisitCounters.set(patientId, currentCounter + 1);
};
const welcomeUser = async (req, res) => {
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
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
exports.welcomeUser = welcomeUser;
