import { Request, Response } from "express";
import { AppUser } from "../models/Appuser";
import bcrypt from "bcrypt";
import { z } from "zod";

const superAdminSchema = z.object({
    fullName: z.string().min(1, "Full name is required").max(100, "Name must be 100 characters or less"),
    email: z.string().min(5, "Email must be at least 5 characters").max(254, "Email must be 254 characters or less").email("Invalid email format"),
    phone: z.string().min(10, "Phone must be at least 10 digits").max(13, "Phone must be 13 characters or less").optional().or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters").max(20, "Password must be 20 characters or less"),
});

/**
 * POST /api/v1/auth/signup-super-admin
 * One-time endpoint to create the first Super Admin
 * DISABLE THIS AFTER CREATING YOUR SUPER ADMIN!
 */
export const signupSuperAdmin = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const parsed = superAdminSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({
                success: false,
                message: parsed.error.issues[0].message,
            });
            return;
        }
        const { fullName, email, password, phone } = parsed.data;

        // Check if Super Admin already exists
        const existingSuperAdmin = await AppUser.findOne({
            where: { email: email },
        });

        if (existingSuperAdmin) {
            res.status(403).json({
                success: false,
                message: "Super Admin already exists. This endpoint is disabled.",
            });
            return;
        }

        // Create Super Admin
        const superAdmin = await AppUser.create({
            fullName,
            phone,
            email: email.toLowerCase(),
            password, // Will be auto-hashed by BeforeCreate hook
            role: "SUPER_ADMIN",
            isEmailVerified: true,
        });

        res.status(201).json({
            success: true,
            message: "Super Admin created successfully",
            data: {
                id: superAdmin.id,
                fullName: superAdmin.fullName,
                phone: superAdmin.phone,
                email: superAdmin.email,
                role: superAdmin.role,
            },
        });
    } catch (error: any) {
        console.error("Signup error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to create Super Admin",
        });
    }
};
