import { sequelize } from "../config/Dbconnetion";
import { AppUser } from "../models/Appuser";
import { AppError } from "../utils/AppError";
import { HTTP_STATUS } from "../utils/constants";
import { generateSecurePassword } from "../utils/passwordUtils";
import { sendPasswordEmail } from "./emailService";
import { createCashfreeVendor } from "./cashfree-vendor.service";
import { createWallet } from "./wallet.service";
import { doctorOnboardRequestRepository } from "../repositories/doctorOnboardRequest.repository";
import { vendorDoctorRepository } from "../repositories/vendorDoctor.repository";

interface SubmitRequestData {
  fullName: string;
  email: string;
  phone?: string;
  hospital?: string;
  specialization?: string;
  license?: string;
  address?: string;
  city?: string;
  state?: string;
  commissionType?: string;
  commissionRate?: number;
  bank?: Record<string, unknown>;
}

class DoctorOnboardService {
  /**
   * Vendor submits a doctor onboard request (pending SuperAdmin approval)
   */
  async submitRequest(vendorId: string, data: SubmitRequestData) {
    // Check if email already exists as an AppUser
    const existingUser = await AppUser.findOne({
      where: { email: data.email.toLowerCase() },
    });
    if (existingUser) {
      throw new AppError(HTTP_STATUS.CONFLICT, "A user with this email already exists. Ask Super Admin to assign the existing doctor to you.");
    }

    // Check for duplicate pending request with same email
    const pendingRequest = await doctorOnboardRequestRepository.findPendingByEmail(data.email);
    if (pendingRequest) {
      throw new AppError(HTTP_STATUS.CONFLICT, "A pending onboard request already exists for this email");
    }

    const request = await doctorOnboardRequestRepository.create({
      vendorId,
      fullName: data.fullName,
      email: data.email.toLowerCase(),
      phone: data.phone,
      hospital: data.hospital,
      specialization: data.specialization,
      license: data.license,
      address: data.address,
      city: data.city,
      state: data.state,
      commissionType: data.commissionType,
      commissionRate: data.commissionRate,
      bankDetails: data.bank,
    });

    return request;
  }

  /**
   * Vendor views their own requests
   */
  async getRequestsForVendor(
    vendorId: string,
    filters: { status?: "PENDING" | "APPROVED" | "REJECTED"; page?: number; limit?: number; search?: string }
  ) {
    const { rows, count } = await doctorOnboardRequestRepository.findByVendorId(vendorId, filters);
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
  async getAllRequests(
    filters: { status?: "PENDING" | "APPROVED" | "REJECTED"; page?: number; limit?: number; search?: string }
  ) {
    const { rows, count } = await doctorOnboardRequestRepository.findAll(filters);
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
  async getRequestById(requestId: string) {
    const request = await doctorOnboardRequestRepository.findById(requestId);
    if (!request) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Doctor onboard request not found");
    }
    return request.toJSON();
  }

  /**
   * SuperAdmin approves a doctor onboard request.
   * Creates the doctor AppUser, Cashfree registration, VendorDoctor association,
   * and sends credential email — all in a transaction.
   */
  async approveRequest(requestId: string, reviewerId: string) {
    const request = await doctorOnboardRequestRepository.findById(requestId);
    if (!request) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Doctor onboard request not found");
    }
    if (request.status !== "PENDING") {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, `Request is already ${request.status.toLowerCase()}`);
    }

    // Check email uniqueness again (could have changed since submission)
    const existingUser = await AppUser.findOne({
      where: { email: request.email.toLowerCase() },
    });
    if (existingUser) {
      throw new AppError(
        HTTP_STATUS.CONFLICT,
        "A user with this email was created after the request was submitted. Reject this request and assign the existing doctor instead."
      );
    }

    const plainPassword = generateSecurePassword();
    let newDoctor: AppUser;
    let cashfreeVendorId: string | null = null;

    // Use transaction for atomic creation
    const transaction = await sequelize.transaction();
    try {
      // 1. Create doctor AppUser
      newDoctor = await AppUser.create(
        {
          fullName: request.fullName,
          email: request.email.toLowerCase(),
          password: plainPassword,
          phone: request.phone,
          role: "DOCTOR",
          parentId: reviewerId, // SuperAdmin who approved
          isEmailVerified: false,
          license: request.license,
          hospital: request.hospital,
          specialization: request.specialization,
          address: request.address,
          city: request.city,
          state: request.state,
          commissionType: request.commissionType,
          commissionRate: request.commissionRate,
        },
        { transaction }
      );

      // 2. Create VendorDoctor association
      await vendorDoctorRepository.create({
        vendorId: request.vendorId,
        doctorId: newDoctor.id,
        assignedBy: reviewerId,
        onboardRequestId: request.id,
      }, transaction);

      // 3. Update request status
      await doctorOnboardRequestRepository.updateStatus(requestId, {
        status: "APPROVED",
        reviewedBy: reviewerId,
        doctorId: newDoctor.id,
      }, transaction);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    // Non-transactional side effects (fire-and-forget patterns)

    // Cashfree registration (non-blocking)
    try {
      const cfResult = await createCashfreeVendor({
        vendorId: newDoctor.id,
        name: request.fullName,
        email: request.email.toLowerCase(),
        phone: request.phone,
        role: "DOCTOR",
        bank: request.bankDetails as { accountNumber: string; ifsc: string; accountHolder: string } | undefined,
      });
      cashfreeVendorId = cfResult.vendor_id;
      await newDoctor.update({ cashfreeVendorId });
    } catch (cfError: unknown) {
      const message = cfError instanceof Error ? cfError.message : "Unknown error";
      console.error(`Cashfree registration failed for ${request.email}:`, message);
    }

    // Create wallet for the new doctor (non-blocking)
    createWallet(newDoctor.id, "DOCTOR").catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Failed to create wallet for doctor ${newDoctor.id}:`, message);
    });

    // Send password email (non-blocking)
    sendPasswordEmail(request.email, plainPassword, "DOCTOR", request.fullName).catch((err: unknown) => {
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
   * Check for duplicate doctors matching a request's phone or license
   */
  async checkDuplicateDoctor(requestId: string) {
    const request = await doctorOnboardRequestRepository.findById(requestId);
    if (!request) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Doctor onboard request not found");
    }

    const matches = await doctorOnboardRequestRepository.findDuplicateDoctors(
      request.phone,
      request.license
    );

    const taggedMatches = matches.map((doc) => {
      const matchedOn: string[] = [];
      if (request.phone && doc.phone === request.phone.trim()) {
        matchedOn.push("phone");
      }
      if (
        request.license &&
        doc.license?.toLowerCase() === request.license.trim().toLowerCase()
      ) {
        matchedOn.push("license");
      }
      return { ...doc.toJSON(), matchedOn };
    });

    return {
      requestId,
      requestDoctor: {
        fullName: request.fullName,
        phone: request.phone,
        license: request.license,
      },
      duplicatesFound: taggedMatches.length,
      duplicates: taggedMatches,
    };
  }

  /**
   * SuperAdmin rejects a doctor onboard request
   */
  async rejectRequest(requestId: string, reviewerId: string, rejectionReason: string) {
    const request = await doctorOnboardRequestRepository.findById(requestId);
    if (!request) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Doctor onboard request not found");
    }
    if (request.status !== "PENDING") {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, `Request is already ${request.status.toLowerCase()}`);
    }

    await doctorOnboardRequestRepository.updateStatus(requestId, {
      status: "REJECTED",
      reviewedBy: reviewerId,
      rejectionReason,
    });

    return { requestId, status: "REJECTED" as const };
  }

  /**
   * SuperAdmin assigns an existing doctor to a vendor
   */
  async assignDoctorToVendor(vendorId: string, doctorId: string, assignedBy: string) {
    // Validate vendor exists and is a vendor
    const vendor = await AppUser.findOne({ where: { id: vendorId, role: "VENDOR" } });
    if (!vendor) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Vendor not found");
    }

    // Validate doctor exists and is a doctor
    const doctor = await AppUser.findOne({ where: { id: doctorId, role: "DOCTOR" } });
    if (!doctor) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Doctor not found");
    }

    // Check if already assigned
    const alreadyAssigned = await vendorDoctorRepository.exists(vendorId, doctorId);
    if (alreadyAssigned) {
      throw new AppError(HTTP_STATUS.CONFLICT, "This doctor is already assigned to this vendor");
    }

    await vendorDoctorRepository.create({ vendorId, doctorId, assignedBy });

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
  async removeDoctorFromVendor(vendorId: string, doctorId: string) {
    const deleted = await vendorDoctorRepository.delete(vendorId, doctorId);
    if (deleted === 0) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Assignment not found");
    }
    return { vendorId, doctorId };
  }

  /**
   * Get all doctors assigned to a vendor (with stats)
   */
  async getVendorDoctors(vendorId: string) {
    return vendorDoctorRepository.getDoctorsWithStatsForVendor(vendorId);
  }
}

export const doctorOnboardService = new DoctorOnboardService();
