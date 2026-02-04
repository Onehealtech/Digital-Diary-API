import { Response } from "express";
import { AppUser } from "../models/Appuser";
import { generateSecurePassword } from "../utils/passwordUtils";
import { sendPasswordEmail } from "../service/emailService";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * POST /api/v1/doctor/create-assistant
 * Doctor creates an Assistant linked to them via parentId
 */
export const createAssistant = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { fullName, email, phone } = req.body;

        // Validate required fields
        if (!fullName || !email) {
            res.status(400).json({
                success: false,
                message: "Full name and email are required",
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

        // Create Assistant with parentId set to the Doctor's ID
        const newAssistant = await AppUser.create({
            fullName,
            email: email.toLowerCase(),
            password: plainPassword,
            phone,
            role: "ASSISTANT",
            parentId: req.user!.id, // Link to the Doctor
            isEmailVerified: false,
        });

        // Send password email
        await sendPasswordEmail(email, plainPassword, "ASSISTANT", fullName);

        res.status(201).json({
            success: true,
            message: `Assistant created successfully. Credentials sent to ${email}`,
            data: {
                id: newAssistant.id,
                fullName: newAssistant.fullName,
                email: newAssistant.email,
                role: newAssistant.role,
                parentId: newAssistant.parentId,
            },
        });
    } catch (error: any) {
        console.error("Create assistant error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to create assistant",
        });
    }
};
