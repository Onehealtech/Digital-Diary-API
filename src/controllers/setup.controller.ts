import { Request, Response } from "express";
import { AppUser } from "../models/Appuser";
import bcrypt from "bcrypt";

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
        const { fullName, email, password } = req.body;

        if (!fullName || !email || !password) {
            res.status(400).json({
                success: false,
                message: "Full name, email, and password are required",
            });
            return;
        }

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
