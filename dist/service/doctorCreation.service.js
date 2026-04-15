"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDoctorService = void 0;
const Appuser_1 = require("../models/Appuser");
const AppError_1 = require("../utils/AppError");
const constants_1 = require("../utils/constants");
const passwordUtils_1 = require("../utils/passwordUtils");
const emailService_1 = require("./emailService");
const wallet_service_1 = require("./wallet.service");
/**
 * Primary operation: create doctor account and complete core setup.
 * Cashfree onboarding is intentionally excluded and handled separately.
 */
const createDoctorService = async (input) => {
    const normalizedEmail = input.email.toLowerCase().trim();
    const existingDoctor = await Appuser_1.AppUser.findOne({
        where: { email: normalizedEmail },
    });
    if (existingDoctor) {
        throw new AppError_1.AppError(constants_1.HTTP_STATUS.CONFLICT, "User with this email already exists");
    }
    const plainPassword = (0, passwordUtils_1.generateSecurePassword)();
    const doctor = await Appuser_1.AppUser.create({
        fullName: input.fullName,
        email: normalizedEmail,
        password: plainPassword,
        phone: input.phone,
        role: constants_1.UserRole.DOCTOR,
        parentId: input.createdBy,
        isEmailVerified: false,
        license: input.license,
        hospital: input.hospital,
        specialization: input.specialization,
        commissionType: input.commissionType,
        commissionRate: input.commissionRate,
        GST: input.GST,
        address: input.address,
        city: input.city,
        state: input.state,
        landLinePhone: input.landLinePhone,
        bankDetails: input.bank,
    });
    // Core doctor setup step.
    await (0, wallet_service_1.createWallet)(doctor.id, "DOCTOR");
    // Send credentials as part of doctor creation workflow.
    await (0, emailService_1.sendPasswordEmail)(normalizedEmail, plainPassword, constants_1.UserRole.DOCTOR, input.fullName);
    return doctor;
};
exports.createDoctorService = createDoctorService;
