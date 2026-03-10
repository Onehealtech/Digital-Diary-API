"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorOnboardService = void 0;
const Dbconnetion_1 = require("../config/Dbconnetion");
const Appuser_1 = require("../models/Appuser");
const AppError_1 = require("../utils/AppError");
const constants_1 = require("../utils/constants");
const passwordUtils_1 = require("../utils/passwordUtils");
const emailService_1 = require("./emailService");
const cashfree_vendor_service_1 = require("./cashfree-vendor.service");
const doctorOnboardRequest_repository_1 = require("../repositories/doctorOnboardRequest.repository");
const vendorDoctor_repository_1 = require("../repositories/vendorDoctor.repository");
class DoctorOnboardService {
    /**
     * Vendor submits a doctor onboard request (pending SuperAdmin approval)
     */
    async submitRequest(vendorId, data) {
        // Check if email already exists as an AppUser
        const existingUser = await Appuser_1.AppUser.findOne({
            where: { email: data.email.toLowerCase() },
        });
        if (existingUser) {
            throw new AppError_1.AppError(constants_1.HTTP_STATUS.CONFLICT, "A user with this email already exists. Ask Super Admin to assign the existing doctor to you.");
        }
        // Check for duplicate pending request with same email
        const pendingRequest = await doctorOnboardRequest_repository_1.doctorOnboardRequestRepository.findPendingByEmail(data.email);
        if (pendingRequest) {
            throw new AppError_1.AppError(constants_1.HTTP_STATUS.CONFLICT, "A pending onboard request already exists for this email");
        }
        const request = await doctorOnboardRequest_repository_1.doctorOnboardRequestRepository.create({
            vendorId,
            fullName: data.fullName,
            email: data.email.toLowerCase(),
            phone: data.phone,
            hospital: data.hospital,
            specialization: data.specialization,
            license: data.license,
            commissionType: data.commissionType,
            commissionRate: data.commissionRate,
            bankDetails: data.bank,
        });
        return request;
    }
    /**
     * Vendor views their own requests
     */
    async getRequestsForVendor(vendorId, filters) {
        const { rows, count } = await doctorOnboardRequest_repository_1.doctorOnboardRequestRepository.findByVendorId(vendorId, filters);
        const { page = 1, limit = 20 } = filters;
        return {
            requests: rows.map((r) => r.toJSON()),
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit),
            },
        };
    }
    /**
     * SuperAdmin views all requests
     */
    async getAllRequests(filters) {
        const { rows, count } = await doctorOnboardRequest_repository_1.doctorOnboardRequestRepository.findAll(filters);
        const { page = 1, limit = 20 } = filters;
        return {
            requests: rows.map((r) => r.toJSON()),
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit),
            },
        };
    }
    /**
     * SuperAdmin gets a single request by ID
     */
    async getRequestById(requestId) {
        const request = await doctorOnboardRequest_repository_1.doctorOnboardRequestRepository.findById(requestId);
        if (!request) {
            throw new AppError_1.AppError(constants_1.HTTP_STATUS.NOT_FOUND, "Doctor onboard request not found");
        }
        return request.toJSON();
    }
    /**
     * SuperAdmin approves a doctor onboard request.
     * Creates the doctor AppUser, Cashfree registration, VendorDoctor association,
     * and sends credential email — all in a transaction.
     */
    async approveRequest(requestId, reviewerId) {
        const request = await doctorOnboardRequest_repository_1.doctorOnboardRequestRepository.findById(requestId);
        if (!request) {
            throw new AppError_1.AppError(constants_1.HTTP_STATUS.NOT_FOUND, "Doctor onboard request not found");
        }
        if (request.status !== "PENDING") {
            throw new AppError_1.AppError(constants_1.HTTP_STATUS.BAD_REQUEST, `Request is already ${request.status.toLowerCase()}`);
        }
        // Check email uniqueness again (could have changed since submission)
        const existingUser = await Appuser_1.AppUser.findOne({
            where: { email: request.email.toLowerCase() },
        });
        if (existingUser) {
            throw new AppError_1.AppError(constants_1.HTTP_STATUS.CONFLICT, "A user with this email was created after the request was submitted. Reject this request and assign the existing doctor instead.");
        }
        const plainPassword = (0, passwordUtils_1.generateSecurePassword)();
        let newDoctor;
        let cashfreeVendorId = null;
        // Use transaction for atomic creation
        const transaction = await Dbconnetion_1.sequelize.transaction();
        try {
            // 1. Create doctor AppUser
            newDoctor = await Appuser_1.AppUser.create({
                fullName: request.fullName,
                email: request.email.toLowerCase(),
                password: plainPassword,
                phone: request.phone,
                role: "DOCTOR",
                parentId: reviewerId,
                isEmailVerified: false,
                license: request.license,
                hospital: request.hospital,
                specialization: request.specialization,
                commissionType: request.commissionType,
                commissionRate: request.commissionRate,
            }, { transaction });
            // 2. Create VendorDoctor association
            await vendorDoctor_repository_1.vendorDoctorRepository.create({
                vendorId: request.vendorId,
                doctorId: newDoctor.id,
                assignedBy: reviewerId,
                onboardRequestId: request.id,
            }, transaction);
            // 3. Update request status
            await doctorOnboardRequest_repository_1.doctorOnboardRequestRepository.updateStatus(requestId, {
                status: "APPROVED",
                reviewedBy: reviewerId,
                doctorId: newDoctor.id,
            }, transaction);
            await transaction.commit();
        }
        catch (error) {
            await transaction.rollback();
            throw error;
        }
        // Non-transactional side effects (fire-and-forget patterns)
        // Cashfree registration (non-blocking)
        try {
            const cfResult = await (0, cashfree_vendor_service_1.createCashfreeVendor)({
                vendorId: newDoctor.id,
                name: request.fullName,
                email: request.email.toLowerCase(),
                phone: request.phone,
                role: "DOCTOR",
                bank: request.bankDetails,
            });
            cashfreeVendorId = cfResult.vendor_id;
            await newDoctor.update({ cashfreeVendorId });
        }
        catch (cfError) {
            const message = cfError instanceof Error ? cfError.message : "Unknown error";
            console.error(`Cashfree registration failed for ${request.email}:`, message);
        }
        // Send password email (non-blocking)
        (0, emailService_1.sendPasswordEmail)(request.email, plainPassword, "DOCTOR", request.fullName).catch((err) => {
            const message = err instanceof Error ? err.message : "Unknown error";
            console.error(`Failed to send password email to ${request.email}:`, message);
        });
        return {
            doctor: {
                id: newDoctor.id,
                fullName: newDoctor.fullName,
                email: newDoctor.email,
                cashfreeVendorId,
            },
            requestId: request.id,
            vendorId: request.vendorId,
        };
    }
    /**
     * SuperAdmin rejects a doctor onboard request
     */
    async rejectRequest(requestId, reviewerId, rejectionReason) {
        const request = await doctorOnboardRequest_repository_1.doctorOnboardRequestRepository.findById(requestId);
        if (!request) {
            throw new AppError_1.AppError(constants_1.HTTP_STATUS.NOT_FOUND, "Doctor onboard request not found");
        }
        if (request.status !== "PENDING") {
            throw new AppError_1.AppError(constants_1.HTTP_STATUS.BAD_REQUEST, `Request is already ${request.status.toLowerCase()}`);
        }
        await doctorOnboardRequest_repository_1.doctorOnboardRequestRepository.updateStatus(requestId, {
            status: "REJECTED",
            reviewedBy: reviewerId,
            rejectionReason,
        });
        return { requestId, status: "REJECTED" };
    }
    /**
     * SuperAdmin assigns an existing doctor to a vendor
     */
    async assignDoctorToVendor(vendorId, doctorId, assignedBy) {
        // Validate vendor exists and is a vendor
        const vendor = await Appuser_1.AppUser.findOne({ where: { id: vendorId, role: "VENDOR" } });
        if (!vendor) {
            throw new AppError_1.AppError(constants_1.HTTP_STATUS.NOT_FOUND, "Vendor not found");
        }
        // Validate doctor exists and is a doctor
        const doctor = await Appuser_1.AppUser.findOne({ where: { id: doctorId, role: "DOCTOR" } });
        if (!doctor) {
            throw new AppError_1.AppError(constants_1.HTTP_STATUS.NOT_FOUND, "Doctor not found");
        }
        // Check if already assigned
        const alreadyAssigned = await vendorDoctor_repository_1.vendorDoctorRepository.exists(vendorId, doctorId);
        if (alreadyAssigned) {
            throw new AppError_1.AppError(constants_1.HTTP_STATUS.CONFLICT, "This doctor is already assigned to this vendor");
        }
        await vendorDoctor_repository_1.vendorDoctorRepository.create({ vendorId, doctorId, assignedBy });
        return {
            vendorId,
            doctorId,
            vendorName: vendor.fullName,
            doctorName: doctor.fullName,
        };
    }
    /**
     * SuperAdmin removes a doctor-vendor assignment
     */
    async removeDoctorFromVendor(vendorId, doctorId) {
        const deleted = await vendorDoctor_repository_1.vendorDoctorRepository.delete(vendorId, doctorId);
        if (deleted === 0) {
            throw new AppError_1.AppError(constants_1.HTTP_STATUS.NOT_FOUND, "Assignment not found");
        }
        return { vendorId, doctorId };
    }
    /**
     * Get all doctors assigned to a vendor (with stats)
     */
    async getVendorDoctors(vendorId) {
        return vendorDoctor_repository_1.vendorDoctorRepository.getDoctorsWithStatsForVendor(vendorId);
    }
}
exports.doctorOnboardService = new DoctorOnboardService();
