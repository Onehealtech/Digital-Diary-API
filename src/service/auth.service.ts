import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { AppUser } from "../models/Appuser";
import dotenv from "dotenv";

dotenv.config(); // ✅ MUST be first
export class DoctorAuthService {
  static async register(data: {
    fullName: string;
    email: string;
    password: string;
    address: string;
    phone?: string;
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
      password: data.password.trim(), // ✅ plain password only
      address: data.address,
      phone: data.phone,
      role: "doctor",
    });


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
      attributes: ["id", "fullName", "email", "phone", "role", "parentId", "permissions", "createdAt"],
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
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
  static async forgotPassword(email: string) {
    const user = await AppUser.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists or not for security
      return {
        message: "If the email exists, a password reset link will be sent",
      };
    }

    // Generate password reset token
    const resetToken = jwt.sign(
      {
        id: user.id,
        type: "password-reset",
      },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" } // Reset token expires in 1 hour
    );

    // In production, you would:
    // 1. Save reset token to database with expiry
    // 2. Send email with reset link containing the token
    // For now, return the token (in production, never return it via API)
    return {
      message: "If the email exists, a password reset link will be sent",
      // TODO: Send email instead of returning token
      resetToken, // Remove this in production
    };
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

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword.trim(), 10);

      // Update password
      await user.update({ password: hashedPassword });

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

}
