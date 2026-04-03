"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryCashfreeOnboarding = exports.createStaff = void 0;
const constants_1 = require("../utils/constants");
const Appuser_1 = require("../models/Appuser");
const passwordUtils_1 = require("../utils/passwordUtils");
const emailService_1 = require("../service/emailService");
const wallet_service_1 = require("../service/wallet.service");
const AppError_1 = require("../utils/AppError");
const doctorCreation_service_1 = require("../service/doctorCreation.service");
const cashfreeOnboarding_service_1 = require("../service/cashfreeOnboarding.service");
const walletTypeMap = {
    VENDOR: "VENDOR",
    DOCTOR: "DOCTOR",
    SUPER_ADMIN: "PLATFORM",
};
const createStaff = async (req, res) => {
    try {
        const { fullName, email, phone, role, bank, upi, license, hospital, specialization, GST, address, city, state, commissionType, commissionRate, landLinePhone, } = req.body;
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
        // Doctor flow (primary + secondary split)
        if (role === constants_1.UserRole.DOCTOR) {
            const doctor = await (0, doctorCreation_service_1.createDoctorService)({
                fullName,
                email,
                phone,
                license,
                hospital,
                specialization,
                GST,
                address,
                city,
                state,
                commissionType,
                commissionRate,
                landLinePhone,
                bank,
                createdBy: req.user.id,
            });
            let cashfree = {
                status: "SUCCESS",
            };
            // Secondary operation: non-blocking. Doctor creation must not fail due to Cashfree.
            // TODO: move this to a background queue/job for retryable async onboarding.
            try {
                await (0, cashfreeOnboarding_service_1.registerCashfreeVendor)({ userId: doctor.id, bank, upi });
            }
            catch (cfError) {
                const detail = cfError instanceof Error ? cfError.message : "Unknown error";
                console.error(`Cashfree onboarding failed for doctor ${doctor.id}:`, detail);
                cashfree = {
                    status: "FAILED",
                    message: "Cashfree onboarding failed. Please retry.",
                };
            }
            // Refresh to include latest cashfreeVendorId if onboarding succeeded.
            await doctor.reload();
            res.status(201).json({
                success: true,
                message: "Doctor created successfully",
                cashfree,
                data: {
                    id: doctor.id,
                    fullName: doctor.fullName,
                    email: doctor.email,
                    role: doctor.role,
                    cashfreeVendorId: doctor.cashfreeVendorId || null,
                    createdBy: req.user.id,
                },
            });
            return;
        }
        // Non-doctor flow (existing behavior retained for VENDOR/SUPER_ADMIN).
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
        const plainPassword = (0, passwordUtils_1.generateSecurePassword)();
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
            bankDetails: bank,
        });
        if (role === constants_1.UserRole.VENDOR || role === constants_1.UserRole.DOCTOR) {
            const walletType = walletTypeMap[role];
            if (walletType) {
                await (0, wallet_service_1.createWallet)(newUser.id, walletType);
            }
        }
        await (0, emailService_1.sendPasswordEmail)(email, plainPassword, role, fullName);
        res.status(201).json({
            success: true,
            message: `${role} created successfully. Credentials sent to ${email}.`,
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
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        const message = error instanceof Error ? error.message : "Failed to create staff member";
        console.error("Create staff error:", message);
        res.status(500).json({
            success: false,
            message,
        });
    }
};
exports.createStaff = createStaff;
/**
 * Retry Cashfree onboarding.
 * Idempotent by design: already-onboarded users return success without duplicate vendor creation.
 */
const retryCashfreeOnboarding = async (req, res) => {
    try {
        const userId = (req.params.userId || req.params.id);
        const { bank, upi } = req.body;
        const result = await (0, cashfreeOnboarding_service_1.registerCashfreeVendor)({ userId, bank, upi });
        if (result.status === "ALREADY_REGISTERED") {
            res.status(200).json({
                success: true,
                message: "User is already registered on Cashfree",
                cashfree: {
                    status: "ALREADY_REGISTERED",
                    vendorId: result.vendorId,
                },
            });
            return;
        }
        res.status(200).json({
            success: true,
            message: "Cashfree vendor onboarding completed",
            cashfree: {
                status: "SUCCESS",
                vendorId: result.vendorId,
            },
        });
    }
    catch (error) {
        if (error instanceof AppError_1.AppError) {
            res.status(error.statusCode).json({ success: false, message: error.message });
            return;
        }
        const message = error instanceof Error ? error.message : "Failed to register on Cashfree";
        console.error("Retry Cashfree onboarding error:", message);
        res.status(500).json({
            success: false,
            message,
        });
    }
};
exports.retryCashfreeOnboarding = retryCashfreeOnboarding;
