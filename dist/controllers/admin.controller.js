"use strict";
// In your staff controller file
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryCashfreeOnboarding = exports.createStaff = void 0;
const Appuser_1 = require("../models/Appuser");
const cashfree_vendor_service_1 = require("../service/cashfree-vendor.service");
const constants_1 = require("../utils/constants");
const passwordUtils_1 = require("../utils/passwordUtils");
const emailService_1 = require("../service/emailService");
const wallet_service_1 = require("../service/wallet.service");
const walletTypeMap = {
    VENDOR: "VENDOR",
    DOCTOR: "DOCTOR",
    SUPER_ADMIN: "PLATFORM",
};
const createStaff = async (req, res) => {
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
        const creatableRoles = [
            constants_1.UserRole.DOCTOR,
            constants_1.UserRole.VENDOR,
            constants_1.UserRole.SUPER_ADMIN,
        ];
        if (!creatableRoles.includes(role)) {
            res.status(400).json({
                success: false,
                message: `Invalid role. Super Admin can create: ${creatableRoles.join(", ")}`,
            });
            return;
        }
        // Check if user already exists
        const existingUser = await Appuser_1.AppUser.findOne({
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
        const plainPassword = (0, passwordUtils_1.generateSecurePassword)();
        // ── Create user in DB first ────────────────────────────────────
        const newUser = await Appuser_1.AppUser.create({
            fullName,
            email: email.toLowerCase(),
            password: plainPassword,
            phone,
            role,
            parentId: req.user.id,
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
        if (role === constants_1.UserRole.VENDOR || role === constants_1.UserRole.DOCTOR) {
            const walletType = walletTypeMap[role];
            if (walletType) {
                await (0, wallet_service_1.createWallet)(newUser.id, walletType);
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
        await (0, emailService_1.sendPasswordEmail)(email, plainPassword, role, fullName);
        // ── Success response ───────────────────────────────────────────
        res.status(201).json({
            success: true,
            message: `${role} created successfully. Credentials sent to ${email}`,
            data: {
                id: newUser.id,
                fullName: newUser.fullName,
                email: newUser.email,
                role: newUser.role,
                createdBy: req.user.id,
            },
        });
    }
    catch (error) {
        console.error("Create staff error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to create staff member",
        });
    }
};
exports.createStaff = createStaff;
/**
 * Retry Cashfree vendor registration for users where it previously failed.
 * Called by SuperAdmin when cashfreeVendorId is null on a Doctor/Vendor.
 */
const retryCashfreeOnboarding = async (req, res) => {
    try {
        const { userId } = req.params;
        const { bank, upi } = req.body;
        const user = await Appuser_1.AppUser.findByPk(userId);
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
        if (![constants_1.UserRole.DOCTOR, constants_1.UserRole.VENDOR].includes(user.role)) {
            res.status(400).json({
                success: false,
                message: "Only Doctors and Vendors need Cashfree registration",
            });
            return;
        }
        const cfResult = await (0, cashfree_vendor_service_1.createCashfreeVendor)({
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
    }
    catch (error) {
        console.error("Retry Cashfree onboarding error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to register on Cashfree",
        });
    }
};
exports.retryCashfreeOnboarding = retryCashfreeOnboarding;
