import jwt from "jsonwebtoken";
import { Patient } from "../models/Patient";

/**
 * Patient Login - Step 1: Validate sticker and request OTP
 */
export const patientLogin = async (
    diaryId: string
): Promise<{ message: string; diaryId: string }> => {
    // Check if sticker exists
    const patient = await Patient.findOne({
        where: { diaryId },
    });

    if (!patient) {
        throw new Error("Invalid sticker ID. Please check your diary.");
    }

    return {
        message: "OTP Required. Please enter the verification code.",
        diaryId,
    };
};

/**
 * Patient Login - Step 2: Verify OTP (hardcoded for MVP) and return JWT
 */
export const verifyPatientOTP = async (
    diaryId: string,
    otp: string
): Promise<{ token: string; patient: any }> => {
    // MVP: Hardcoded OTP validation
    if (otp !== "1234") {
        throw new Error("Invalid OTP");
    }

    // Get patient details
    const patient = await Patient.findOne({
        where: { diaryId },
        attributes: ["id", "diaryId", "fullName", "age", "status", "caseType", "doctorId"],
    });

    if (!patient) {
        throw new Error("Patient not found");
    }

    // Generate long-lived JWT token (30 days for illiterate users)
    const token = jwt.sign(
        {
            id: patient.id,
            diaryId: patient.diaryId,
            fullName: patient.fullName,
            type: "PATIENT",
        },
        process.env.JWT_SECRET!,
        { expiresIn: "30d" }
    );

    return {
        token,
        patient: {
            id: patient.id,
            diaryId: patient.diaryId,
            fullName: patient.fullName,
            age: patient.age,
            status: patient.status,
            caseType: patient.caseType,
        },
    };
};
