import jwt from "jsonwebtoken";
import { Patient } from "../models/Patient";

/**
 * Patient Login - Step 1: Validate sticker and request OTP
 */
export const patientLogin = async (
    stickerId: string
): Promise<{ message: string; stickerId: string }> => {
    // Check if sticker exists
    const patient = await Patient.findOne({
        where: { stickerId },
    });

    if (!patient) {
        throw new Error("Invalid sticker ID. Please check your diary.");
    }

    return {
        message: "OTP Required. Please enter the verification code.",
        stickerId,
    };
};

/**
 * Patient Login - Step 2: Verify OTP (hardcoded for MVP) and return JWT
 */
export const verifyPatientOTP = async (
    stickerId: string,
    otp: string
): Promise<{ token: string; patient: any }> => {
    // MVP: Hardcoded OTP validation
    if (otp !== "1234") {
        throw new Error("Invalid OTP");
    }

    // Get patient details
    const patient = await Patient.findOne({
        where: { stickerId },
        attributes: ["id", "stickerId", "fullName", "age", "status", "doctorId"],
    });

    if (!patient) {
        throw new Error("Patient not found");
    }

    // Generate long-lived JWT token (30 days for illiterate users)
    const token = jwt.sign(
        {
            id: patient.id,
            stickerId: patient.stickerId,
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
            stickerId: patient.stickerId,
            fullName: patient.fullName,
            age: patient.age,
            status: patient.status,
        },
    };
};
