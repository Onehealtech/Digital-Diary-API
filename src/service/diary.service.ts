import { GeneratedDiary } from "../models/GeneratedDiary";
import { Diary } from "../models/Diary";
import { DiaryRequest } from "../models/DiaryRequest";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { VendorProfile } from "../models/VendorProfile";
import { Transaction } from "../models/Transaction";
import { Notification } from "../models/Notification";
import { Op } from "sequelize";
import QRCode from "qrcode";
import { TemplatePage, TemplateField, TemplateJson, DiaryTemplate } from "../models/DiaryTemplate";
const SKIP_PAGES = new Set(["01"]);           // TOC — no question_no/answer
const NO_INPUT_TYPES = new Set([              // purely informational pages
  "informational", "notice",
]);
function shouldSkipPage(page: TemplatePage): boolean {
  return SKIP_PAGES.has(page.page_no) || NO_INPUT_TYPES.has(page.page_type ?? "");
}

function stampField(field: TemplateField, sectionNo: number, qNo: number): TemplateField {
  return {
    ...field,
    question_no: `Q${qNo}`,
    answer: null,
  };
}

function stampPage(page: TemplatePage): TemplatePage {
  if (shouldSkipPage(page)) return page;

  // ── Pages with sections ──────────────────────────────────────────────────
  if (page.sections && page.sections.length > 0) {
    let sectionNo = 0;
    const stampedSections = page.sections.map((sec) => {
      sectionNo++;
      let qNo = 0;

      // Named section with nested fields
      if (sec.fields && sec.fields.length > 0) {
        const stampedFields = sec.fields.map((f) => stampField(f, sectionNo, ++qNo));
        // Bare field sitting at section level (e.g. "Next Appointment Required")
        const bare = (sec as any).field_name
          ? { ...(sec as any), question_no: `${++qNo}`, answer: null }
          : sec;
        return { ...bare, fields: stampedFields };
      }

      // Section IS a bare field (no nested fields array)
      if ((sec as any).field_name) {
        return { ...sec, question_no: `${++qNo}`, answer: null };
      }

      return sec;
    });

    return { ...page, sections: stampedSections };
  }

  // ── Pages with only flat fields (one implicit section = S1) ─────────────
  if (page.fields && page.fields.length > 0) {
    let qNo = 0;
    const stampedFields = page.fields.map((f) => stampField(f, 1, ++qNo));
    return { ...page, fields: stampedFields };
  }

  return page;
}

/**
 * Takes the master template JSON and returns a deep-cloned copy
 * with question_no + answer:null injected on every input field (pages 02–37).
 */
export function buildDiaryInstance(template: TemplateJson): TemplateJson {
  return {
    ...template,
    pages: template.pages.map(stampPage),
  };
}
export class DiaryService {
  /**
   * Generate diary IDs in bulk with QR codes
   */
  async generateDiaries(quantity: number, diaryType: string = "breast-cancer-treatment") {
    if (quantity < 1 || quantity > 500) {
      throw new Error("Quantity must be between 1 and 500");
    }

    const currentYear = new Date().getFullYear();
    const diaries: GeneratedDiary[] = [];

    // Get last sequence number for this year
    const lastDiary = await GeneratedDiary.findOne({
      where: {
        id: {
          [Op.like]: `DRY-${currentYear}-BC-%`,
        },
      },
      order: [["createdAt", "DESC"]],
    });

    let sequence = 1;
    if (lastDiary) {
      const lastSequence = parseInt(lastDiary.id.split("-")[3]);
      sequence = lastSequence + 1;
    }

    // Generate diaries
    for (let i = 0; i < quantity; i++) {
      const diaryId = `DRY-${currentYear}-BC-${String(sequence).padStart(3, "0")}`;

      // Generate QR code as base64 string (in real app, upload to S3/GCP)
      const qrCodeUrl = await QRCode.toDataURL(diaryId);

      const diary = await GeneratedDiary.create({
        id: diaryId,
        diaryType,
        status: "unassigned",
        generatedDate: new Date(),
        qrCodeUrl,
      });

      diaries.push(diary);
      sequence++;
    }

    return { diaries, count: quantity };
  }

  /**
   * Get all generated diaries with filters
   */
  async getAllGeneratedDiaries(params: {
    page?: number;
    limit?: number;
    status?: string;
    vendorId?: string;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    const whereClause: any = {};

    if (params.status) {
      whereClause.status = params.status;
    }

    if (params.vendorId) {
      whereClause.assignedTo = params.vendorId;
    }

    if (params.search) {
      whereClause.id = { [Op.iLike]: `%${params.search}%` };
    }

    const diaries = await GeneratedDiary.findAndCountAll({
      where: whereClause,
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
   * Get diary by ID
   */
  async getDiaryById(diaryId: string) {
    const diary = await GeneratedDiary.findByPk(diaryId);

    if (!diary) {
      throw new Error("Diary not found");
    }

    return diary;
  }

  /**
   * Assign diary to vendor
   */
  async assignDiaryToVendor(diaryId: string, vendorId: string) {
    const diary = await GeneratedDiary.findByPk(diaryId);

    if (!diary) {
      throw new Error("Diary not found");
    }

    if (diary.status !== "unassigned") {
      throw new Error("Diary is already assigned or sold");
    }

    diary.assignedTo = vendorId;
    diary.assignedDate = new Date();
    diary.status = "assigned";
    await diary.save();

    return diary;
  }

  /**
   * Bulk assign diaries to vendor
   */
  async bulkAssignDiaries(diaryIds: string[], vendorId: string) {
    const updated = await GeneratedDiary.update(
      {
        assignedTo: vendorId,
        assignedDate: new Date(),
        status: "assigned",
      },
      {
        where: {
          id: { [Op.in]: diaryIds },
          status: "unassigned",
        },
      }
    );

    return { assignedCount: updated[0] };
  }

  /**
   * Unassign diary from vendor
   */
  async unassignDiary(diaryId: string) {
    const diary = await GeneratedDiary.findByPk(diaryId);

    if (!diary) {
      throw new Error("Diary not found");
    }

    if (diary.status !== "assigned") {
      throw new Error("Cannot unassign diary that is sold or active");
    }

    diary.assignedTo = undefined;
    diary.assignedDate = undefined;
    diary.status = "unassigned";
    await diary.save();

    return diary;
  }

  async getAllSoldDiaries(params: {
    page?: number;
    limit?: number;
    vendorId?: string;
    search?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    const where: any = {};

    if (params.vendorId) {
      where.vendorId = params.vendorId;
    }

    const diaries = await Diary.findAndCountAll({
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Patient,
          as: "patient",
        },
        {
          model: AppUser,
          as: "doctor",
          attributes: ["id", "fullName", "email"],
        },
        {
          model: AppUser,
          as: "vendor",
          attributes: ["id", "fullName", "email"],
        },
      ],
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
   * Approve diary sale
   */
  async approveDiarySale(diaryId: string, superAdminId: string) {
    const diary = await Diary.findByPk(diaryId);

    if (!diary) {
      throw new Error("Diary not found");
    }

    if (diary.status !== "pending") {
      throw new Error("Diary is not pending approval");
    }

    // Update diary status
    diary.status = "active";
    diary.approvedBy = superAdminId;
    diary.approvedAt = new Date();
    diary.activationDate = new Date();
    await diary.save();

    // Update generated diary
    await GeneratedDiary.update(
      { status: "active" },
      { where: { id: diaryId } }
    );
    const generatedDiary: any = await GeneratedDiary.findByPk(diaryId);
    let diaryTypeTemplate: string = "";
    if (generatedDiary.diaryType == "peri-operative") {
      diaryTypeTemplate = "PERI-OPERATIVE";
    }
    const generatedTemplate: any = await DiaryTemplate.findOne({ where: { code: diaryTypeTemplate } });
    const diaryInstance = buildDiaryInstance(generatedTemplate.templateData);
    diary.diaryData = diaryInstance;
    await diary.save();
    // Credit vendor commission
    // const vendorProfile = await VendorProfile.findOne({
    //   where: { vendorId: diary.vendorId },
    // });

    // if (vendorProfile) {
    //   const balanceBefore = parseFloat(vendorProfile.walletBalance.toString());
    //   const balanceAfter = balanceBefore + parseFloat(diary.commissionAmount.toString());

    //   // Create transaction
    //   await Transaction.create({
    //     vendorId: diary.vendorId,
    //     type: "commission",
    //     amount: diary.commissionAmount,
    //     balanceBefore,
    //     balanceAfter,
    //     diaryId: diary.id,
    //     description: "Commission for diary sale",
    //     processedBy: superAdminId,
    //     timestamp: new Date(),
    //   });

    //   // Update wallet
    //   vendorProfile.walletBalance = balanceAfter;
    //   vendorProfile.diariesSold += 1;
    //   await vendorProfile.save();

    //   // Mark commission as paid
    //   diary.commissionPaid = true;
    //   await diary.save();
    // }

    // Create notification for vendor
    await Notification.create({
      recipientId: diary.vendorId,
      recipientType: "staff",
      senderId: superAdminId,
      type: "info",
      severity: "low",
      title: "Diary Sale Approved",
      message: `Your diary sale (${diaryId}) has been approved. Commission ₹${diary.commissionAmount} credited to your wallet.`,
      read: false,
      delivered: true,
    });

    return diary;
  }

  /**
   * Reject diary sale
   */
  async rejectDiarySale(diaryId: string, superAdminId: string, reason: string) {
    const diary = await Diary.findByPk(diaryId);

    if (!diary) {
      throw new Error("Diary not found");
    }

    if (diary.status !== "pending") {
      throw new Error("Diary is not pending approval");
    }

    // Update diary status
    diary.status = "rejected";
    diary.rejectionReason = reason;
    await diary.save();

    // Reset generated diary to assigned status
    await GeneratedDiary.update(
      { status: "assigned", soldTo: undefined, soldDate: undefined },
      { where: { id: diaryId } }
    );

    // Create notification for vendor
    await Notification.create({
      recipientId: diary.vendorId,
      recipientType: "staff",
      senderId: superAdminId,
      type: "alert",
      severity: "medium",
      title: "Diary Sale Rejected",
      message: `Your diary sale (${diaryId}) has been rejected. Reason: ${reason}`,
      read: false,
      delivered: true,
    });

    return diary;
  }

  /**
   * Get all diary requests
   */
  async getAllDiaryRequests(params: {
    page?: number;
    limit?: number;
    vendorId?: string;
    status?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const whereClause: any = {};

    whereClause.vendorId = params.vendorId;

    if (params.status) {
      whereClause.status = params.status;
    }

    const requests = await DiaryRequest.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: AppUser,
          as: "vendor",
          attributes: ["id", "fullName", "email"],
        },
      ],
      limit,
      offset,
      order: [["requestDate", "DESC"]],
    });

    const pendingCount = await DiaryRequest.count({
      where: { status: "pending" },
    });

    return {
      data: requests.rows,
      total: requests.count,
      pendingCount,
      page,
      limit,
      totalPages: Math.ceil(requests.count / limit),
    };
  }
  async getALLDiaryRequestSuperAdmin(params: {
    page?: number;
    limit?: number;
    vendorId?: string;
    status?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const whereClause: any = {};


    if (params.status) {
      whereClause.status = params.status;
    }

    const requests = await DiaryRequest.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: AppUser,
          as: "vendor",
          attributes: ["id", "fullName", "email"],
        },
      ],
      limit,
      offset,
      order: [["requestDate", "DESC"]],
    });

    const pendingCount = await DiaryRequest.count({
      where: { status: "pending" },
    });

    return {
      data: requests.rows,
      total: requests.count,
      pendingCount,
      page,
      limit,
      totalPages: Math.ceil(requests.count / limit),
    };
  }

  /**
   * Create diary request
   */
  async createDiaryRequest(vendorId: string, quantity: number, message?: string, dairyType?: string) {
    if (quantity < 1 || quantity > 500) {
      throw new Error("Quantity must be between 1 and 500");
    }

    const request = await DiaryRequest.create({
      vendorId,
      quantity,
      message,
      dairyType,
      status: "pending",
      requestDate: new Date(),
    });

    // Create notification for all super admins
    const superAdmins = await AppUser.findAll({
      where: { role: "SUPER_ADMIN" },
    });

    for (const admin of superAdmins) {
      await Notification.create({
        recipientId: admin.id,
        recipientType: "staff",
        senderId: vendorId,
        type: "info",
        severity: "medium",
        title: "New Diary Request",
        message: `Vendor has requested ${quantity} diaries of type ${dairyType}.`,
        read: false,
        delivered: true,
      });
    }

    return request;
  }

  /**
   * Approve diary request
   */
  async approveDiaryRequest(requestId: string, superAdminId: string) {
    const request = await DiaryRequest.findByPk(requestId);

    if (!request) {
      throw new Error("Request not found");
    }

    if (request.status !== "pending") {
      throw new Error("Request is not pending");
    }

    // Check if there are enough unassigned diaries
    const availableDiaries = await GeneratedDiary.findAll({
      where: { status: "unassigned" },
      limit: request.quantity,
    });

    let diaryIds: string[] = [];

    if (availableDiaries.length >= request.quantity) {
      // Assign existing diaries
      diaryIds = availableDiaries.map((d) => d.id);
      await this.bulkAssignDiaries(diaryIds, request.vendorId);
    } else {
      // Generate new diaries if not enough available
      const needed = request.quantity - availableDiaries.length;
      const generated = await this.generateDiaries(needed);
      const newDiaryIds = generated.diaries.map((d) => d.id);

      // Assign all diaries
      if (availableDiaries.length > 0) {
        await this.bulkAssignDiaries(
          availableDiaries.map((d) => d.id),
          request.vendorId
        );
      }
      await this.bulkAssignDiaries(newDiaryIds, request.vendorId);

      diaryIds = [...availableDiaries.map((d) => d.id), ...newDiaryIds];
    }

    // Update request
    request.status = "fulfilled";
    request.fulfilledDate = new Date();
    request.fulfilledBy = superAdminId;
    request.assignedDiaryIds = diaryIds;
    await request.save();

    // Notify vendor
    await Notification.create({
      recipientId: request.vendorId,
      recipientType: "staff",
      senderId: superAdminId,
      type: "info",
      severity: "low",
      title: "Diary Request Approved",
      message: `Your request for ${request.quantity} diaries has been approved and assigned to your inventory.`,
      read: false,
      delivered: true,
    });

    return request;
  }

  /**
   * Reject diary request
   */
  async rejectDiaryRequest(requestId: string, superAdminId: string, reason: string) {
    const request = await DiaryRequest.findByPk(requestId);

    if (!request) {
      throw new Error("Request not found");
    }

    if (request.status !== "pending") {
      throw new Error("Request is not pending");
    }

    request.status = "rejected";
    request.rejectionReason = reason;
    await request.save();

    // Notify vendor
    await Notification.create({
      recipientId: request.vendorId,
      recipientType: "staff",
      senderId: superAdminId,
      type: "alert",
      severity: "medium",
      title: "Diary Request Rejected",
      message: `Your request for ${request.quantity} diaries has been rejected. Reason: ${reason}`,
      read: false,
      delivered: true,
    });

    return request;
  }
}
