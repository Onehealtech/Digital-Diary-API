import jwt from "jsonwebtoken";
import { Patient } from "../models/Patient";
import { Diary } from "../models/Diary";
import { generateOTP, verifyOTP } from "./otpService";
import { twilioService } from "./twilio.service";

/**
 * Patient Login - Step 1: Validate sticker and send OTP via SMS (Twilio)
 * Patients receive OTP on mobile only.
 */
export const patientLogin = async (
    diaryId: string
): Promise<{ message: string; diaryId: string; phone?: string }> => {
    // Check if sticker exists
    const patient = await Patient.findOne({
        where: { diaryId },
        include: [{ model: Diary, as: "diary", attributes: ["status"] }],
    });

    if (!patient) {
        throw new Error("Invalid sticker ID. Please check your diary.");
    }

    if (patient.status === "INACTIVE") {
        throw new Error("Your account has been deactivated. Please contact your doctor.");
    }

    const diary = (patient as any).diary as Diary | undefined;
    if (diary?.status === "PENDING") {
        throw new Error("Your diary is not yet approved by the admin. Please wait for approval.");
    }
    if (diary?.status === "REJECTED") {
        throw new Error("Your diary has been rejected. Please contact your doctor.");
    }

    // Generate OTP locally and send via Twilio SMS
    const phone = patient.phone;
    if (phone) {
        const otp = generateOTP(diaryId);
        const sent = await twilioService.sendOTP(phone, otp);
        if (!sent) {
            console.warn(`Failed to send OTP SMS to ${phone} for diary ${diaryId}`);
        }
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
 * Patient Login - Step 2: Verify OTP (locally generated, verified in-memory)
 * Patients verify via SMS OTP only.
 */
export const verifyPatientOTP = async (
    diaryId: string,
    otp: string
): Promise<{ token: string; patient: Record<string, unknown> }> => {

    // Get patient details
    const patient = await Patient.findOne({
        where: { diaryId },
        attributes: ["id", "diaryId", "fullName", "age", "status", "caseType", "doctorId", "phone", "tokenVersion"],
    });

    if (!patient) {
        throw new Error("Patient not found");
    }

    if (patient.status === "INACTIVE") {
        throw new Error("Your account has been deactivated. Please contact your doctor.");
    }

    const diary = (patient as any).diary as Diary | undefined;
    if (diary?.status === "PENDING") {
        throw new Error("Your diary is not yet approved by the admin. Please wait for approval.");
    }
    if (diary?.status === "REJECTED") {
        throw new Error("Your diary has been rejected. Please contact your doctor.");
    }

    // Verify OTP from local store (keyed by diaryId)
    const isValid = verifyOTP(diaryId, otp);

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
            tokenVersion: (patient as any).tokenVersion ?? 0,
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
