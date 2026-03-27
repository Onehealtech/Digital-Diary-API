"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signupSuperAdmin = void 0;
const Appuser_1 = require("../models/Appuser");
const zod_1 = require("zod");
const superAdminSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(1, "Full name is required").max(100, "Name must be 100 characters or less"),
    email: zod_1.z.string().min(5, "Email must be at least 5 characters").max(254, "Email must be 254 characters or less").email("Invalid email format"),
    phone: zod_1.z.string().min(10, "Phone must be at least 10 digits").max(13, "Phone must be 13 characters or less").optional().or(zod_1.z.literal("")),
    password: zod_1.z.string().min(8, "Password must be at least 8 characters").max(20, "Password must be 20 characters or less"),
});
/**
 * POST /api/v1/auth/signup-super-admin
 * One-time endpoint to create the first Super Admin
 * DISABLE THIS AFTER CREATING YOUR SUPER ADMIN!
 */
const signupSuperAdmin = async (req, res) => {
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
