import jwt from "jsonwebtoken";
import { Patient } from "../models/Patient";
import { messageCentralService } from "./messageCentral.service";

/**
 * Patient Login - Step 1: Validate sticker and send OTP via Message Central
 */
export const patientLogin = async (
    diaryId: string
): Promise<{ message: string; diaryId: string; phone?: string }> => {
    // Check if sticker exists
    const patient = await Patient.findOne({
        where: { diaryId },
    });

    if (!patient) {
        throw new Error("Invalid sticker ID. Please check your diary.");
    }

    if (patient.status === "INACTIVE") {
        throw new Error("Your account has been deactivated. Please contact your doctor.");
    }

    // Send OTP via Message Central
    const phone = patient.phone;
    if (phone) {
        await messageCentralService.sendOTP(phone, diaryId);
    } else {
        console.warn(`No phone number recorded for patient ${diaryId}. OTP not sent via SMS.`);
    }

    return {
        message: "OTP sent. Please enter the verification code.",
        diaryId,
        phone,
    };
};

/**
 * Patient Login - Step 2: Verify OTP via Message Central
 */
export const verifyPatientOTP = async (
    diaryId: string,
    otp: string
): Promise<{ token: string; patient: Record<string, unknown> }> => {

    // Get patient details first (need phone for verification)
    const patient = await Patient.findOne({
        where: { diaryId },
        attributes: ["id", "diaryId", "fullName", "age", "status", "caseType", "doctorId", "phone"],
    });

    if (!patient) {
        throw new Error("Patient not found");
    }

    if (patient.status === "INACTIVE") {
        throw new Error("Your account has been deactivated. Please contact your doctor.");
    }

    // MVP: "1234" backdoor for testing. Remove in production.
    let isValid = otp === "1234";

    if (!isValid && patient.phone) {
        isValid = await messageCentralService.verifyOTP(patient.phone, diaryId, otp);
    }

    if (!isValid) {
        throw new Error("Invalid or expired OTP");
    }

    // Generate long-lived JWT token (30 days for illiterate users)
    const token = jwt.sign(
        {
            id: patient.id,
            diaryId: patient.diaryId,
            fullName: patient.fullName,
            caseType: patient.caseType,
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
