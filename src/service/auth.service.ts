import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppUser } from "../models/Appuser";
import { Wallet } from "../models/Wallet";
import { creditReferralCoins } from "./wallet.service";
import { sendPasswordResetEmail } from "./emailService";
import dotenv from "dotenv";

dotenv.config(); // ✅ MUST be first
export class DoctorAuthService {
  static async register(data: {
    fullName: string;
    email: string;
    password: string;
    address: string;
    phone?: string;
    referredByCode?: string;
  }) {
    const existing = await AppUser.findOne({
      where: { email: data.email },
    });

    if (existing) {
      throw new Error("Doctor already exists");
    }

    const doctor = await AppUser.create({
      fullName: data.fullName,
      email: data.email.toLowerCase(),
      password: data.password.trim(),
      address: data.address,
      phone: data.phone,
      role: "DOCTOR",
      isActive: false,
      selfRegistered: true,
    });

    // Credit referral coins to the referrer (non-blocking)
    if (data.referredByCode) {
      AppUser.findOne({ where: { referralCode: data.referredByCode.trim().toUpperCase() } })
        .then((referrer) => {
          if (!referrer || referrer.id === doctor.id) return;
          return creditReferralCoins({ referrerId: referrer.id, referredDoctorId: doctor.id });
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error(`Referral coin credit failed for code ${data.referredByCode}:`, message);
        });
    }

    return doctor;
  }

  static async login(email: string, password: string) {
    const doctor = await AppUser.findOne({
      where: { email: email.toLowerCase(), role: "doctor" },
    });

    if (!doctor) {
      throw new Error("Doctor not found");
    }

    const isMatch = await bcrypt.compare(password.trim(), doctor.password);
    if (!isMatch) {
      throw new Error("Invalid credentials");
    }

    const token = jwt.sign(
      {
        id: doctor.id,
        role: doctor.role,
        fullName: doctor.fullName,
        email: doctor.email,
        tokenVersion: (doctor as any).tokenVersion ?? 0,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    return { token, doctor };
  }

  /**
   * Get current user by ID
   */
  static async getCurrentUser(userId: string) {
    const user = await AppUser.findByPk(userId, {
      attributes: ["id", "fullName", "email", "phone", "role", "parentId", "permissions", "createdAt", "referralCode"],
    });

    if (!user) {
      throw new Error("User not found");
    }

    const wallet = await Wallet.findOne({
      where: { userId },
      attributes: ["coinBalance"],
    });

    return {
      ...user.toJSON(),
      coinBalance: wallet?.coinBalance ?? 0,
    };
  }

  /**
   * Refresh access token
   */
  static async refreshToken(oldToken: string) {
    try {
      // Verify the old token (even if expired)
      const decoded = jwt.verify(oldToken, process.env.JWT_SECRET!, {
        ignoreExpiration: true,
      }) as any;

      // Get user from database to ensure they still exist
      const user = await AppUser.findByPk(decoded.id);

      if (!user) {
        throw new Error("User not found");
      }

      // Generate new token
      const newToken = jwt.sign(
        {
          id: user.id,
          role: user.role,
          fullName: user.fullName,
          email: user.email,
          tokenVersion: (user as any).tokenVersion ?? 0,
        },
        process.env.JWT_SECRET!,
        { expiresIn: "7d" }
      );

      return { token: newToken, user };
    } catch (error: any) {
      if (error.name === "JsonWebTokenError") {
        throw new Error("Invalid token");
      }
      throw error;
    }
  }

  /**
   * Logout user (token blacklisting would be implemented here in production)
   */
  static async logout(userId: string) {
    // In production, you would:
    // 1. Add token to blacklist/redis
    // 2. Set token expiry
    // For now, just return success
    return {
      message: "Logged out successfully",
      userId,
    };
  }

  /**
   * Forgot password - Generate reset token
   */
  static async forgotPassword(email: string, currentPassword?: string) {
    const user = await AppUser.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new Error("Invalid email or current password");
    }

    // Verify current password if provided
    if (currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword.trim(), user.password);
      if (!isMatch) {
        throw new Error("Invalid email or current password");
      }
    }

    // Generate password reset token
    const resetToken = jwt.sign(
      {
        id: user.id,
        type: "password-reset",
      },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    await sendPasswordResetEmail(user.email, user.fullName || user.email, resetToken);

    return {
      message: "If the email exists, a password reset link has been sent to your inbox.",
    };
  }

  /**
   * Verify a password-reset token is valid and not expired.
   * Called before showing the reset-password form so the UI can
   * reject stale links early without waiting for a form submission.
   */
  static async verifyResetToken(resetToken: string) {
    try {
      const decoded = jwt.verify(resetToken, process.env.JWT_SECRET!) as any;

      if (decoded.type !== "password-reset") {
        throw new Error("Invalid reset token");
      }

      const user = await AppUser.findByPk(decoded.id, {
        attributes: ["id", "email", "fullName"],
      });

      if (!user) {
        throw new Error("User not found");
      }

      return { valid: true, email: user.email };
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        throw new Error("Reset token has expired");
      }
      if (error.name === "JsonWebTokenError") {
        throw new Error("Invalid reset token");
      }
      throw error;
    }
  }

  /**
   * Reset password using reset token
   */
  static async resetPassword(resetToken: string, newPassword: string) {
    try {
      // Verify reset token
      const decoded = jwt.verify(resetToken, process.env.JWT_SECRET!) as any;

      if (decoded.type !== "password-reset") {
        throw new Error("Invalid reset token");
      }

      // Get user
      const user = await AppUser.findByPk(decoded.id);

      if (!user) {
        throw new Error("User not found");
      }

      // Update password — the @BeforeUpdate hook in AppUser hashes it automatically
      await user.update({ password: newPassword.trim() });

      return {
        message: "Password reset successfully",
      };
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        throw new Error("Reset token has expired");
      }
      if (error.name === "JsonWebTokenError") {
        throw new Error("Invalid reset token");
      }
      throw error;
    }
  }
  /**
   * Update profile (fullName and/or phone) for the authenticated user
   */
  static async updateProfile(userId: string, fullName?: string, phone?: string, bankDetails?: { accountHolder?: string; accountNumber?: string; ifsc?: string; bankName?: string }) {
    const user = await AppUser.findByPk(userId);

    if (!user) {
      throw new Error("User not found");
    }

    if (!fullName?.trim()) {
      throw new Error("Full name is required");
    }

    const updateData: Record<string, unknown> = {
      fullName: fullName.trim(),
      ...(phone !== undefined && { phone: phone.trim() || null }),
    };

    if (bankDetails !== undefined) {
      updateData.bankDetails = bankDetails;
    }

    await user.update(updateData);

    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      bankDetails: (user as any).bankDetails || null,
    };
  }

  static async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ) {
    // 1️⃣ Find user
    const user = await AppUser.findByPk(userId);

    if (!user) {
      throw new Error("User not found");
    }

    // 2️⃣ Verify old password
    const isMatch = await bcrypt.compare(oldPassword.trim(), user.password);

    if (!isMatch) {
      throw new Error("Old password is incorrect");
    }

    // 3️⃣ Prevent same password reuse
    const isSamePassword = await bcrypt.compare(
      newPassword.trim(),
      user.password
    );

    if (isSamePassword) {
      throw new Error("New password cannot be same as old password");
    }

    // 4️⃣ Update password — @BeforeUpdate hook in AppUser hashes it automatically
    await user.update({ password: newPassword.trim() });

    return {
      message: "Password changed successfully",
    };
  }
}
