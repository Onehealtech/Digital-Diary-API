import { Response } from "express";
import { AppUser } from "../models/Appuser";
import { generateSecurePassword } from "../utils/passwordUtils";
import { sendPasswordEmail } from "../service/emailService";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";

/**
 * POST /api/v1/admin/create-staff
 * Super Admin creates Vendor, Doctor, or another Super Admin
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

        // Validate role – only these roles can be created by Super Admin
        const creatableRoles: UserRole[] = [
            UserRole.DOCTOR,
            UserRole.VENDOR,
            UserRole.SUPER_ADMIN,
        ];

        if (!creatableRoles.includes(role as UserRole)) {
            res.status(400).json({
                success: false,
                message: `Invalid role. Super Admin can create: ${creatableRoles.join(", ")}`,
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
            parentId: req.user!.id, // Track who created this user
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
                createdBy: req.user!.id,
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
