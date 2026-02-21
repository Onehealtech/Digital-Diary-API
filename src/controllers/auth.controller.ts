import { Request, Response } from "express";
import { DoctorAuthService } from "../service/auth.service";
import { sendResponse, sendError } from "../utils/response";
import { AuthRequest } from "../middleware/authMiddleware";

export class DoctorAuthController {
  static async register(req: Request, res: Response) {
    try {
      const doctor = await DoctorAuthService.register(req.body);

      return res.status(201).json({
        message: "Doctor registered successfully",
        data: {
          id: doctor.id,
          fullName: doctor.fullName,
          email: doctor.email,
        },
      });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      const result = await DoctorAuthService.login(email, password);

      return res.json({
        message: "Login successful",
        token: result.token,
        doctor: {
          id: result.doctor.id,
          fullName: result.doctor.fullName,
          email: result.doctor.email,
        },
      });
    } catch (error: any) {
      return res.status(401).json({ message: error.message });
    }
  }

  /**
   * GET /api/v1/auth/me
   * Get current logged-in user details
   */
  static async getCurrentUser(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, "Unauthorized", 401);
      }

      const user = await DoctorAuthService.getCurrentUser(userId);

      return sendResponse(res, user, "User details fetched successfully");
    } catch (error: any) {
      return sendError(res, error.message, 404);
    }
  }

  /**
   * POST /api/v1/auth/logout
   * Logout user
   */
  static async logout(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return sendError(res, "Unauthorized", 401);
      }

      const result = await DoctorAuthService.logout(userId);

      return sendResponse(res, result, "Logged out successfully");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * POST /api/v1/auth/refresh
   * Refresh access token
   */
  static async refreshToken(req: Request, res: Response) {
    try {
      const { token } = req.body;

      if (!token) {
        return sendError(res, "Token is required", 400);
      }

      const result = await DoctorAuthService.refreshToken(token);

      return sendResponse(res, result, "Token refreshed successfully");
    } catch (error: any) {
      return sendError(res, error.message, 401);
    }
  }

  /**
   * POST /api/v1/auth/forgot-password
   * Request password reset
   */
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return sendError(res, "Email is required", 400);
      }

      const result = await DoctorAuthService.forgotPassword(email);

      return sendResponse(res, result, "Password reset instructions sent");
    } catch (error: any) {
      return sendError(res, error.message);
    }
  }

  /**
   * POST /api/v1/auth/reset-password
   * Reset password using reset token
   */
  static async resetPassword(req: Request, res: Response) {
    try {
      const { resetToken, newPassword } = req.body;

      if (!resetToken || !newPassword) {
        return sendError(res, "resetToken and newPassword are required", 400);
      }

      if (newPassword.length < 6) {
        return sendError(res, "Password must be at least 6 characters", 400);
      }

      const result = await DoctorAuthService.resetPassword(resetToken, newPassword);

      return sendResponse(res, result, "Password reset successfully");
    } catch (error: any) {
      return sendError(res, error.message, 400);
    }
  }
  static async changePassword(req: any, res: any) {
  try {
    const userId = req.user.id; // from JWT middleware
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        message: "Old password and new password are required",
      });
    }

    const result = await DoctorAuthService.changePassword(
      userId,
      oldPassword,
      newPassword
    );

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({
      message: error.message,
    });
  }
}
}
