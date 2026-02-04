import { Response } from "express";
import { AppUser } from "../models/Appuser";
import { generateSecurePassword } from "../utils/passwordUtils";
import { sendPasswordEmail } from "../service/emailService";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * POST /api/v1/admin/create-staff
 * Super Admin creates Doctor or Pharmacist
 */
export const createStaff = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { fullName, email, phone, role } = req.body;

        // Validate required fields
        if (!fullName || !email || !role) {
            res.status(400).json({
                success: false,
                message: "Full name, email, and role are required",
            });
            return;
        }

        // Validate role (only DOCTOR or PHARMACIST can be created by Super Admin)
        if (role !== "DOCTOR" && role !== "PHARMACIST") {
            res.status(400).json({
                success: false,
                message: "Role must be either DOCTOR or PHARMACIST",
            });
            return;
        }

        // Check if user already exists
        const existingUser = await AppUser.findOne({
            where: { email: email.toLowerCase() },
        });

        if (existingUser) {
            res.status(409).json({
                success: false,
                message: "User with this email already exists",
            });
            return;
        }

        // Generate secure password
        const plainPassword = generateSecurePassword();

        // Create user (password will be auto-hashed by BeforeCreate hook)
        const newUser = await AppUser.create({
            fullName,
            email: email.toLowerCase(),
            password: plainPassword,
            phone,
            role,
            isEmailVerified: false,
        });

        // Send password email
        await sendPasswordEmail(email, plainPassword, role, fullName);

        res.status(201).json({
            success: true,
            message: `${role} created successfully. Credentials sent to ${email}`,
            data: {
                id: newUser.id,
                fullName: newUser.fullName,
                email: newUser.email,
                role: newUser.role,
            },
        });
    } catch (error: any) {
        console.error("Create staff error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to create staff member",
        });
    }
};
