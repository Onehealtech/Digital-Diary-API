import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppUser } from "../models/Appuser";
import { generateOTP, verifyOTP } from "./otpService";
import { sendOTPEmail } from "./emailService";

/**
 * Staff Login - Step 1: Validate credentials and send OTP
 */
export const staffLogin = async (
    email: string,
    password: string
): Promise<{ message: string; email: string }> => {
    const user = await AppUser.findOne({
        where: { email: email.toLowerCase() },
    });

    if (!user) {
        throw new Error("Invalid credentials");
    }

    // Verify password
    const isMatch = await bcrypt.compare(password.trim(), user.password);
    if (!isMatch) {
        throw new Error("Invalid credentials");
    }

    // Generate and send OTP
    const otp = generateOTP(email);
    await sendOTPEmail(email, otp, user.fullName);

    return {
        message: "OTP sent to your email",
        email: email.toLowerCase(),
    };
};

/**
 * Staff Login - Step 2: Verify OTP and return JWT
 */
export const verifyStaffOTP = async (
    email: string,
    otp: string
): Promise<{ token: string; user: any }> => {
    // Verify OTP
    const isValid = verifyOTP(email, otp);
    if (!isValid) {
        throw new Error("Invalid or expired OTP");
    }

    // Get user details
    const user = await AppUser.findOne({
        where: { email: email.toLowerCase() },
        attributes: ["id", "fullName", "email", "role", "parentId", "isEmailVerified"],
    });

    if (!user) {
        throw new Error("User not found");
    }

    // Generate JWT token
    const token = jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            parentId: user.parentId,
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
            role: user.role,
            parentId: user.parentId,
        },
    };
};
