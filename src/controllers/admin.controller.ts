// In your staff controller file

import { sequelize } from "../config/Dbconnetion";
import { AppUser } from "../models/Appuser";

import { createCashfreeVendor } from "../service/cashfree-vendor.service";
import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { UserRole } from "../utils/constants";
import { generateSecurePassword } from "../utils/passwordUtils";
import { sendPasswordEmail } from "../service/emailService";
import { createWallet } from "../service/wallet.service";
const walletTypeMap: Record<string, "VENDOR" | "DOCTOR" | "PLATFORM"> = {
    VENDOR: "VENDOR",
    DOCTOR: "DOCTOR",
    SUPER_ADMIN: "PLATFORM",
};

export const createStaff = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { fullName, email, phone, role, bank, upi, license, hospital, specialization, GST, address, city, state, commissionType, commissionRate, landLinePhone } = req.body;

        // ── Validate required fields ───────────────────────────────────
        if (!fullName || !email || !role) {
            res.status(400).json({
                success: false,
                message: "Full name, email, and role are required",
            });
            return;
        }

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

        // ── Generate password ──────────────────────────────────────────
        const plainPassword = generateSecurePassword();

        // ── Create user in DB first ────────────────────────────────────
        const newUser = await AppUser.create({
            fullName,
            email: email.toLowerCase(),
            password: plainPassword,
            phone,
            role,
            parentId: req.user!.id,
            isEmailVerified: false,
            license,
            hospital,
            specialization,
            commissionType,
            commissionRate,
            GST,
            address,
            city,
            state,
            landLinePhone,
        });
        // Create wallet for VENDOR and DOCTOR roles
        if (role === UserRole.VENDOR || role === UserRole.DOCTOR) {
            const walletType = walletTypeMap[role];
            if (walletType) {
                await createWallet(newUser.id, walletType);
            }
        }

        // ── Cashfree vendor registration (DISABLED — uncomment when needed) ──
        // let cashfreeVendorId: string | null = null;
        // const needsCashfree = [UserRole.DOCTOR, UserRole.VENDOR].includes(role as UserRole);
        // if (needsCashfree) {
        //     try {
        //         const cfResult = await createCashfreeVendor({
        //             vendorId: newUser.id,
        //             name: fullName,
        //             email: email.toLowerCase(),
        //             phone,
        //             role,
        //             bank,
        //             upi,
        //         });
        //         cashfreeVendorId = cfResult.vendor_id;
        //         await newUser.update({ cashfreeVendorId });
        //     } catch (cfError: any) {
        //         console.error(`Cashfree vendor registration failed for ${email}:`, cfError.message);
        //         await sendPasswordEmail(email, plainPassword, role, fullName);
        //         res.status(201).json({
        //             success: true,
        //             message: `${role} created successfully. Credentials sent to ${email}.`,
        //             data: { id: newUser.id, fullName: newUser.fullName, email: newUser.email, role: newUser.role, cashfreeVendorId: null, createdBy: req.user!.id },
        //             warnings: [{ type: "CASHFREE_ONBOARDING_FAILED", message: "Cashfree vendor registration failed. Please retry onboarding from the user profile.", detail: cfError.message }],
        //         });
        //         return;
        //     }
        // }

        // ── Send password email ────────────────────────────────────────
        await sendPasswordEmail(email, plainPassword, role, fullName);

        // ── Success response ───────────────────────────────────────────
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

/**
 * Retry Cashfree vendor registration for users where it previously failed.
 * Called by SuperAdmin when cashfreeVendorId is null on a Doctor/Vendor.
 */
export const retryCashfreeOnboarding = async (
    req: AuthenticatedRequest,
    res: Response
): Promise<void> => {
    try {
        const { userId }: any = req.params;
        const { bank, upi } = req.body;

        const user = await AppUser.findByPk(userId);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        if (user.cashfreeVendorId) {
            res.status(400).json({
                success: false,
                message: "User is already registered on Cashfree",
                data: { cashfreeVendorId: user.cashfreeVendorId },
            });
            return;
        }

        if (![UserRole.DOCTOR, UserRole.VENDOR].includes(user.role as UserRole)) {
            res.status(400).json({
                success: false,
                message: "Only Doctors and Vendors need Cashfree registration",
            });
            return;
        }

        const cfResult = await createCashfreeVendor({
            vendorId: user.id,
            name: user.fullName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            bank,
            upi,
        });

        await user.update({ cashfreeVendorId: cfResult.vendor_id });

        res.status(200).json({
            success: true,
            message: "Cashfree vendor registration successful",
            data: {
                id: user.id,
                cashfreeVendorId: cfResult.vendor_id,
                cashfreeStatus: cfResult.status,
            },
        });
    } catch (error: any) {
        console.error("Retry Cashfree onboarding error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to register on Cashfree",
        });
    }
};