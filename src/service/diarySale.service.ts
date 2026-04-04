import { sequelize } from "../config/Dbconnetion";
import { AppUser } from "../models/Appuser";
import { Diary } from "../models/Diary";
import { DiaryRequest } from "../models/DiaryRequest";
import { GeneratedDiary } from "../models/GeneratedDiary";
import { Notification } from "../models/Notification";
import { Patient } from "../models/Patient";
import { AppError } from "../utils/AppError";
import { HTTP_STATUS } from "../utils/constants";
import { Op } from "sequelize";
import { DIARY_STATUS, normalizeDiaryStatus } from "../utils/diaryStatus";

interface SellDiaryParams {
  diaryId: string;
  patientName: string;
  age: number;
  gender: string;
  phone: string;
  address?: string;
  doctorId?: string;
  paymentAmount: number;
  caseType?: string;
  sellerId: string;
  sellerRole: "SUPER_ADMIN" | "VENDOR" | "DOCTOR" | "ASSISTANT";
}

class DiarySaleService {
  /**
   * Sell a diary — role-aware logic for all 4 roles.
   *
   * All seller roles create diary entries in PENDING state.
   * Super Admin approval transitions the diary to APPROVED.
   */
  async sellDiary(params: SellDiaryParams) {
    const { diaryId, sellerId, sellerRole } = params;

    const doctorId = await this.resolveDoctorId(params);

    const transaction = await sequelize.transaction();

    try {

      // 1️⃣ Lock Generated Diary
      const generatedDiary = await GeneratedDiary.findOne({
        where: { id: diaryId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!generatedDiary) {
        throw new Error("Diary not found");
      }

      if (generatedDiary.status === "sold") {
        throw new Error("Diary already sold");
      }

      // 2️⃣ Status Logic
      const vendorId = sellerRole === "VENDOR" ? sellerId : null;

      // 3️⃣ Create Patient
      const patient = await Patient.create(
        {
          stickerId: diaryId,
          fullName: params.patientName,
          age: params.age,
          gender: params.gender,
          phone: params.phone,
          address: params.address,
          diaryId,
          vendorId,
          doctorId,
          caseType: params.caseType || "PERI_OPERATIVE",
          status: "ACTIVE",
          registeredDate: new Date(),
        },
        { transaction }
      );

      // 4️⃣ Create Diary
      const diary = await Diary.create(
        {
          id: diaryId,
          patientId: patient.id,
          doctorId,
          vendorId,
          soldBy: sellerId,
          soldByRole: sellerRole,
          status: DIARY_STATUS.PENDING,
          activationDate: null,
          approvedBy: null,
          approvedAt: null,
          saleAmount: params.paymentAmount || 0,
          commissionAmount: 0,
          commissionPaid: false,
        },
        { transaction }
      );
      // 5️⃣ Update Generated Diary
      generatedDiary.status = "sold";
      generatedDiary.soldTo = patient.id;
      generatedDiary.soldDate = new Date();

      await generatedDiary.save({ transaction });

      await transaction.commit();

      console.info(`[DIARY_CREATE] sellerRole=${sellerRole} sellerId=${sellerId} diaryId=${diaryId} status=${diary.status}`);

      this.notifySuperAdminsOfSale(
        sellerId,
        sellerRole,
        diaryId
      ).catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        console.error("Notification error:", message);
      });

      return {
        patient: {
          id: patient.id,
          fullName: patient.fullName,
          diaryId: patient.diaryId,
        },
        diary: {
          id: diary.id,
          status: diary.status,
          doctorId,
          soldByRole: sellerRole,
        },
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Resolve the doctorId based on seller role:
   * - DOCTOR: self
   * - ASSISTANT: parentId (their parent doctor)
   * - VENDOR/SUPER_ADMIN: from request body (required)
   */
  private async resolveDoctorId(params: SellDiaryParams): Promise<string> {
    const { sellerId, sellerRole, doctorId } = params;

    if (sellerRole === "DOCTOR") {
      return sellerId;
    }

    if (sellerRole === "ASSISTANT") {
      const assistant = await AppUser.findByPk(sellerId, { attributes: ["id", "parentId"] });
      if (!assistant?.parentId) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, "Assistant has no parent doctor assigned");
      }
      return assistant.parentId;
    }

    // VENDOR or SUPER_ADMIN must provide doctorId
    if (!doctorId) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, "Doctor ID is required for this role");
    }

    const doctor = await AppUser.findOne({ where: { id: doctorId, role: "DOCTOR" } });
    if (!doctor) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Doctor not found");
    }

    return doctorId;
  }

  /**
   * Validate diary availability based on seller role:
   * - SUPER_ADMIN: any diary with status unassigned or assigned
   * - VENDOR: diary assigned to them with status assigned
   * - DOCTOR: diary assigned to them with status assigned
   * - ASSISTANT: diary assigned to parent doctor with status assigned
   */
  private async validateDiaryForSeller(
    diaryId: string,
    sellerId: string,
    sellerRole: string
  ): Promise<GeneratedDiary> {
    const diary = await GeneratedDiary.findByPk(diaryId);

    if (!diary) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Diary not found");
    }

    if (diary.status === "sold" || diary.status === "active") {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, "Diary is already sold or active");
    }

    if (sellerRole === "SUPER_ADMIN") {
      // SuperAdmin can sell any unassigned or assigned diary
      if (diary.status !== "unassigned" && diary.status !== "assigned") {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, "Diary is not available for sale");
      }
      return diary;
    }

    // VENDOR or DOCTOR: diary must be assigned to them
    if (sellerRole === "VENDOR" || sellerRole === "DOCTOR") {
      if (diary.status !== "assigned" || diary.assignedTo !== sellerId) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, "Diary is not assigned to you");
      }
      return diary;
    }

    // ASSISTANT: diary must be assigned to parent doctor
    if (sellerRole === "ASSISTANT") {
      const assistant = await AppUser.findByPk(sellerId, { attributes: ["id", "parentId"] });
      if (!assistant?.parentId) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, "Assistant has no parent doctor assigned");
      }
      if (diary.status !== "assigned" || diary.assignedTo !== assistant.parentId) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, "Diary is not assigned to your doctor");
      }
      return diary;
    }

    throw new AppError(HTTP_STATUS.FORBIDDEN, "You are not authorized to sell diaries");
  }

  /**
   * Get inventory for the current user based on role
   */
  async getInventory(
    userId: string,
    role: string,
    params: { page?: number; limit?: number; search?: string }
  ) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = { status: "assigned" };

    if (role === "SUPER_ADMIN") {
      // SuperAdmin sees all unassigned + assigned diaries
      where.status = { [Op.in]: ["unassigned", "assigned"] };
      delete where.assignedTo;
    } else if (role === "VENDOR" || role === "DOCTOR") {
      where.assignedTo = userId;
    } else if (role === "ASSISTANT") {
      const assistant = await AppUser.findByPk(userId, { attributes: ["id", "parentId"] });
      if (!assistant?.parentId) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, "Assistant has no parent doctor assigned");
      }
      where.assignedTo = assistant.parentId;
    }

    if (params.search) {
      where.id = { [Op.iLike]: `%${params.search}%` };
    }

    const diaries = await GeneratedDiary.findAndCountAll({
      where,
      limit,
      offset,
      order: [["generatedDate", "DESC"]],
    });

    return {
      data: diaries.rows,
      total: diaries.count,
      page,
      limit,
      totalPages: Math.ceil(diaries.count / limit),
    };
  }

  /**
   * Get sales history for the current user based on role
   */
  async getSales(
    userId: string,
    role: string,
    params: { page?: number; limit?: number; status?: string }
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;
    const where: Record<string, unknown> = {};

    if (role === "SUPER_ADMIN") {
      // SuperAdmin sees only their own sales (soldBy = self)
      where.soldBy = userId;
    } else if (role === "VENDOR") {
      where.vendorId = userId;
    } else if (role === "DOCTOR") {
      where.soldBy = userId;
      where.soldByRole = "DOCTOR";
    } else if (role === "ASSISTANT") {
      where.soldBy = userId;
      where.soldByRole = "ASSISTANT";
    }

    if (params.status) {
      where.status = normalizeDiaryStatus(params.status);
    }

    const diaries = await Diary.findAndCountAll({
      where,
      include: [
        { model: Patient, as: "patient" },
        { model: AppUser, as: "doctor", attributes: ["id", "fullName", "email"] },
        // { model: AppUser, as: "vendor", attributes: ["id", "fullName", "email"] },
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    console.info(
      `[DIARY_FETCH] scope=sales role=${role} userId=${userId} total=${diaries.count}`
    );

    const rows = diaries.rows.map((diary: any) => diary.toJSON());

    return {
      data: rows,
      total: diaries.count,
      page,
      limit,
      totalPages: Math.ceil(diaries.count / limit),
    };
  }

  /**
   * Request diaries (Vendor or Doctor)
   */
  async requestDiaries(
    userId: string,
    role: "VENDOR" | "DOCTOR",
    quantity: number,
    message?: string,
    diaryType?: string
  ) {
    const request = await DiaryRequest.create({
      vendorId: role === "VENDOR" ? userId : undefined,
      requesterId: userId,
      requesterRole: role,
      quantity,
      message,
      dairyType: diaryType,
      status: "pending",
      requestDate: new Date(),
    });

    // Notify super admins
    const superAdmins = await AppUser.findAll({ where: { role: "SUPER_ADMIN" } });
    const requester = await AppUser.findByPk(userId, { attributes: ["fullName"] });

    for (const admin of superAdmins) {
      Notification.create({
        recipientId: admin.id,
        recipientType: "staff",
        senderId: userId,
        type: "info",
        severity: "medium",
        title: "New Diary Request",
        message: `${role} ${requester?.fullName || "Unknown"} has requested ${quantity} diaries.`,
        read: false,
        delivered: true,
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("Failed to create diary request notification:", msg);
      });
    }

    return request;
  }

  /**
   * Get diary requests for the current user
   */
  async getMyDiaryRequests(
    userId: string,
    role: string,
    params: { page?: number; limit?: number; status?: string }
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (role === "VENDOR") {
      where.vendorId = userId;
    } else if (role === "DOCTOR") {
      where.requesterId = userId;
      where.requesterRole = "DOCTOR";
    }

    if (params.status) {
      where.status = params.status;
    }

    const requests = await DiaryRequest.findAndCountAll({
      where,
      limit,
      offset,
      order: [["requestDate", "DESC"]],
    });

    return {
      data: requests.rows,
      total: requests.count,
      page,
      limit,
      totalPages: Math.ceil(requests.count / limit),
    };
  }

  /**
   * Mark a diary sale as fund transferred.
   * Checks that the diary was sold by the requesting user (via soldBy or vendorId).
   */
  async markFundTransferred(diaryId: string, userId: string) {
    const diary = await Diary.findOne({
      where: {
        id: diaryId,
        [Op.or]: [{ soldBy: userId }, { vendorId: userId }],
      },
    });

    if (!diary) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, "Sale record not found");
    }

    if (diary.fundTransferred) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, "Funds already transferred for this sale");
    }

    diary.fundTransferred = true;
    await diary.save();

    return { message: "Sale marked as fund transferred", diaryId };
  }

  /**
   * Fire-and-forget notification to SuperAdmins about a new pending sale
   */
  private async notifySuperAdminsOfSale(
    sellerId: string,
    sellerRole: string,
    diaryId: string
  ): Promise<void> {
    const superAdmins = await AppUser.findAll({ where: { role: "SUPER_ADMIN" } });
    const seller = await AppUser.findByPk(sellerId, { attributes: ["fullName"] });

    for (const admin of superAdmins) {
      await Notification.create({
        recipientId: admin.id,
        recipientType: "staff",
        senderId: sellerId,
        type: "info",
        severity: "medium",
        title: "New Diary Sale Pending Approval",
        message: `${sellerRole} ${seller?.fullName || "Unknown"} sold diary ${diaryId}. Awaiting your approval.`,
        read: false,
        delivered: true,
      });
    }
  }
}

export const diarySaleService = new DiarySaleService();

