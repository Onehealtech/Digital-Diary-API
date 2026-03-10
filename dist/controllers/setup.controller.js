"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signupSuperAdmin = void 0;
const Appuser_1 = require("../models/Appuser");
/**
 * POST /api/v1/auth/signup-super-admin
 * One-time endpoint to create the first Super Admin
 * DISABLE THIS AFTER CREATING YOUR SUPER ADMIN!
 */
const signupSuperAdmin = async (req, res) => {
    try {
        const { fullName, email, password, phone } = req.body;
        if (!fullName || !email || !password) {
            res.status(400).json({
                success: false,
                message: "Full name, email, and password are required",
            });
            return;
        }
        // Check if Super Admin already exists
        const existingSuperAdmin = await Appuser_1.AppUser.findOne({
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
        const superAdmin = await Appuser_1.AppUser.create({
            fullName,
            phone,
            email: email.toLowerCase(),
            password,
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
    }
    catch (error) {
        console.error("Signup error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to create Super Admin",
        });
    }
};
exports.signupSuperAdmin = signupSuperAdmin;
