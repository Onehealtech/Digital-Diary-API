import { Op, Transaction } from "sequelize";
import { DoctorOnboardRequest } from "../models/DoctorOnboardRequest";
import { AppUser } from "../models/Appuser";

interface ListFilters {
  status?: "PENDING" | "APPROVED" | "REJECTED";
  page?: number;
  limit?: number;
  search?: string;
}

class DoctorOnboardRequestRepository {
  async create(data: {
    vendorId: string;
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
    bankDetails?: Record<string, unknown>;
  }): Promise<DoctorOnboardRequest> {
    return DoctorOnboardRequest.create(data);
  }

  async findById(id: string): Promise<DoctorOnboardRequest | null> {
    return DoctorOnboardRequest.findByPk(id, {
      include: [
        { model: AppUser, as: "vendor", attributes: ["id", "fullName", "email", "phone"] },
        { model: AppUser, as: "reviewer", attributes: ["id", "fullName"] },
        { model: AppUser, as: "doctor", attributes: ["id", "fullName", "email", "phone", "hospital", "specialization"] },
      ],
    });
  }

  async findByVendorId(vendorId: string, filters: ListFilters = {}): Promise<{ rows: DoctorOnboardRequest[]; count: number }> {
    const { status, page = 1, limit = 20, search } = filters;
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = { vendorId };
    if (status) where.status = status;
    if (search) {
      (where as Record<string, unknown>)[Op.or as unknown as string] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    return DoctorOnboardRequest.findAndCountAll({
      where,
      include: [
        { model: AppUser, as: "doctor", attributes: ["id", "fullName", "email", "hospital", "specialization"] },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
  }

  async findAll(filters: ListFilters = {}): Promise<{ rows: DoctorOnboardRequest[]; count: number }> {
    const { status, page = 1, limit = 20, search } = filters;
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      (where as Record<string, unknown>)[Op.or as unknown as string] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    return DoctorOnboardRequest.findAndCountAll({
      where,
      include: [
        { model: AppUser, as: "vendor", attributes: ["id", "fullName", "email", "phone"] },
        { model: AppUser, as: "doctor", attributes: ["id", "fullName", "email", "hospital", "specialization"] },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
  }

  async findPendingByEmail(email: string): Promise<DoctorOnboardRequest | null> {
    return DoctorOnboardRequest.findOne({
      where: { email: email.toLowerCase(), status: "PENDING" },
    });
  }

  /**
   * Find existing doctors matching by phone or license number
   */
  async findDuplicateDoctors(phone?: string, license?: string): Promise<AppUser[]> {
    const conditions: Record<string, unknown>[] = [];

    if (phone && phone.trim()) {
      conditions.push({ phone: phone.trim() });
    }
    if (license && license.trim()) {
      conditions.push({ license: { [Op.iLike]: license.trim() } });
    }

    if (conditions.length === 0) return [];

    return AppUser.findAll({
      where: {
        role: "DOCTOR",
        [Op.or]: conditions,
      },
      attributes: [
        "id", "fullName", "email", "phone", "license", "hospital",
        "specialization", "city", "state", "isActive", "createdAt",
      ],
      paranoid: false,
    });
  }

  async updateStatus(
    id: string,
    data: {
      status: "APPROVED" | "REJECTED";
      reviewedBy: string;
      rejectionReason?: string;
      doctorId?: string;
    },
    transaction?: Transaction
  ): Promise<void> {
    await DoctorOnboardRequest.update(
      {
        status: data.status,
        reviewedBy: data.reviewedBy,
        reviewedAt: new Date(),
        rejectionReason: data.rejectionReason || null,
        doctorId: data.doctorId || null,
      },
      { where: { id }, ...(transaction && { transaction }) }
    );
  }
}

export const doctorOnboardRequestRepository = new DoctorOnboardRequestRepository();
