import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppUser } from "../models/Appuser";
import { generateOTP, storeOTP, verifyOTPMultiKey } from "./otpService";
import { sendOTPEmail } from "./emailService";
import { twilioService } from "./twilio.service";
import { sendLoginOTP } from "./smsfortius.service";

/**
 * Staff Login - Step 1: Validate credentials and send OTP via Email + SMS
 * Roles: Super Admin, Doctor, Assistant, Vendor
 */
export const staffLogin = async (
    email: string,
    password: string
): Promise<{ message: string; email: string }> => {
    // Use paranoid: false so archived (soft-deleted) assistants get a clear error
    const user = await AppUser.findOne({
        where: { email: email.toLowerCase() },
        paranoid: false,
    });

    if (!user) {
        throw new Error("Invalid credentials");
    }

    // Verify password
    const isMatch = await bcrypt.compare(password.trim(), user.password);
    if (!isMatch) {
        throw new Error("Invalid credentials");
    }

    // Block login for inactive users — distinguish pending approval from admin-deactivated
    if (user.isActive === false) {
        const message = (user as any).selfRegistered
            ? "Your account is pending approval from the Super Admin. You will be able to log in once approved."
            : "Your account has been deactivated. Please contact your administrator.";
        throw Object.assign(
            new Error(message),
            { loginBlocked: true, userId: user.id }
        );
    }

    // Block login for archived (soft-deleted) users
    if ((user as any).deletedAt !== null) {
        throw Object.assign(
            new Error("Your account has been archived. Please contact your administrator to restore access."),
            { loginBlocked: true, userId: user.id }
        );
    }

    // Block login for on-hold assistants
    if (user.role === "ASSISTANT") {
        const status = (user as any).assistantStatus;
        if (status === "DELETED") {
            throw Object.assign(
                new Error("Your account has been archived. Contact your Doctor to restore access."),
                { loginBlocked: true, assistantId: user.id }
            );
        }
        if (status === "ON_HOLD") {
            throw Object.assign(
                new Error("Your account is temporarily on hold. Contact your Doctor."),
                { loginBlocked: true, assistantId: user.id }
            );
        }
    }

    // Generate a single OTP — send the SAME code via Email and SMS
    const otp = generateOTP(email);

    // Store the same OTP under the phone key so verification works from either channel
    if (user.phone) {
        storeOTP(user.phone, otp);
    }

    // Send OTP via Email
    try {
        await sendOTPEmail(email, otp, user.fullName);
    } catch (err) {
        console.error("Failed to send OTP email:", err);
        // Continue — SMS may still work
    }

    // Send the same OTP via SMS (Twilio)
    if (user.phone) {

        const expiryMinutes = process.env.OTP_EXPIRY_MINUTES || "5";
        const sent = await sendLoginOTP(user.phone, otp, expiryMinutes);
            console.log(sent ? `OTP sent via Fortius to ${user.phone}` : `Failed to send OTP via Fortius to ${user.phone}`);
    }   

    return {
        message: "OTP sent to your email and phone",
        email: email.toLowerCase(),
    };
};

/**
 * Staff Login - Step 2: Verify OTP and return JWT
 * OTP validation works regardless of whether user enters OTP from email or SMS.
 */
export const verifyStaffOTP = async (
    email: string,
    otp: string
): Promise<{ token: string; user: any }> => {
    // Get user to retrieve phone for multi-key verification
    const user = await AppUser.findOne({
        where: { email: email.toLowerCase() },
        attributes: ["id", "fullName", "email", "phone", "role", "parentId", "isEmailVerified", "assistantStatus", "isActive", "deletedAt", "tokenVersion"],
        paranoid: false,
    });

    if (!user) {
        throw new Error("User not found");
    }

    // Verify OTP against both email and phone keys
    const keysToCheck = [email];
    if (user.phone) {
        keysToCheck.push(user.phone);
    }

    const isValid = verifyOTPMultiKey(keysToCheck, otp);
    if (!isValid) {
        throw new Error("Invalid or expired OTP");
    }

    // Block OTP verification for deactivated users
    if (user.isActive === false) {
        const message = (user as any).selfRegistered
            ? "Your account is pending approval from the Super Admin."
            : "Your account has been deactivated. Please contact your administrator.";
        throw new Error(message);
    }

    // Block OTP verification for archived (soft-deleted) users
    if ((user as any).deletedAt !== null) {
        throw new Error("Your account has been archived. Please contact your administrator to restore access.");
    }

    // Block OTP verification for on-hold assistants
    if (user.role === "ASSISTANT") {
        const status = (user as any).assistantStatus;
        if (status === "DELETED") {
            throw new Error("Your account has been archived. Please contact your doctor.");
        }
        if (status === "ON_HOLD") {
            throw new Error("Your account is temporarily on hold. Contact your Doctor.");
        }
    }

    // Generate JWT token
    const token = jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            parentId: user.parentId,
            tokenVersion: (user as any).tokenVersion ?? 0,
        },
        process.env.JWT_SECRET as string,
        { expiresIn: "7d" }
    );

    return {
        token,
        user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone || null,
            role: user.role,
            parentId: user.parentId,
        },
    };
};
