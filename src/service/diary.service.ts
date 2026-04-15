import { GeneratedDiary } from "../models/GeneratedDiary";
import { Diary } from "../models/Diary";
import { DiaryRequest } from "../models/DiaryRequest";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";
import { VendorProfile } from "../models/VendorProfile";
import { Transaction } from "../models/Transaction";
import { Notification } from "../models/Notification";
import { Op } from "sequelize";
import path from "path";
import QRCode from "qrcode";
import sharp from "sharp";
import { DIARY_STATUS, normalizeDiaryStatus } from "../utils/diaryStatus";
import {
  Document,
  Packer,
  Paragraph,
  Table as DocxTable,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  TextRun,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  VerticalAlign,
} from "docx";

export class DiaryService {
  /**
   * Generate diary IDs in bulk with QR codes
   */
  async generateDiaries(quantity: number, diaryType: string = "breast-cancer-treatment") {
    if (quantity < 1 || quantity > 500) {
      throw new Error("Quantity must be between 1 and 500");
    }

    const diaries: GeneratedDiary[] = [];

    // Get last sequence number across all CanTRAC diaries
    const lastDiary = await GeneratedDiary.findOne({
      where: {
        id: {
          [Op.like]: `CanTRAC-A%`,
        },
      },
      order: [["createdAt", "DESC"]],
    });

    let sequence = 1;
    if (lastDiary) {
      const lastSequence = parseInt(lastDiary.id.replace("CanTRAC-A", ""), 10);
      if (!isNaN(lastSequence)) sequence = lastSequence + 1;
    }

    // Generate diaries
    for (let i = 0; i < quantity; i++) {
      const diaryId = `CanTRAC-A${String(sequence).padStart(3, "0")}`;

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
    diaryType?: string;
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
    if (params.diaryType) {
      whereClause.diaryType = params.diaryType;
    }

    const diaries = await GeneratedDiary.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [["generatedDate", "DESC"]],
    });

    // Resolve vendor names for assigned diaries, including archived vendors (paranoid: false).
    // This ensures the "Assigned To" column always shows the vendor name, even after archiving.
    const vendorIds = [
      ...new Set(diaries.rows.map((d) => d.assignedTo).filter(Boolean)),
    ] as string[];

    const vendorNameMap = new Map<string, string>();
    if (vendorIds.length > 0) {
      const vendors = await AppUser.findAll({
        where: { id: { [Op.in]: vendorIds } },
        attributes: ["id", "fullName"],
        paranoid: false, // include archived vendors
      });
      vendors.forEach((v) => vendorNameMap.set(v.id, v.fullName));
    }

    return {
      data: diaries.rows.map((d) => ({
        ...d.toJSON(),
        assignedVendorName: d.assignedTo ? (vendorNameMap.get(d.assignedTo) ?? null) : null,
      })),
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
    ],
  });

  const rows = await Promise.all(
    diaries.rows.map(async (diary: any) => {
      let vendor = null;

      if (diary.vendorId) {
        vendor = await AppUser.findOne({
          where: { id: diary.vendorId },
          attributes: ["id", "fullName", "email"],
        });
      }

      return {
        ...diary.toJSON(),
        status: normalizeDiaryStatus(diary.status),
        vendor,
      };
    })
  );

  console.info(`[DIARY_FETCH] scope=super_admin_inventory total=${diaries.count}`);

  return {
    data: rows,
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

    if (normalizeDiaryStatus(diary.status) !== DIARY_STATUS.PENDING) {
      throw new Error("Diary is not pending approval");
    }

    // Update diary status
    diary.status = DIARY_STATUS.APPROVED;
    diary.approvedBy = superAdminId;
    diary.approvedAt = new Date();
    diary.activationDate = new Date();
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

    // Create notification for the seller (soldBy or vendorId for backward compat)
    const approvalRecipientId = diary.soldBy || diary.vendorId;
    if (approvalRecipientId) {
      await Notification.create({
        recipientId: approvalRecipientId,
        recipientType: "staff",
        senderId: superAdminId,
        type: "info",
        severity: "low",
        title: "Diary Sale Approved",
        message: `Your diary sale (${diaryId}) has been approved.`,
        read: false,
        delivered: true,
      });
    }

    console.info(`[DIARY_APPROVAL] diaryId=${diaryId} approvedBy=${superAdminId} status=${diary.status}`);

    return diary;
  }

  /**
   * Reject diary sale
   */
  async rejectDiarySale(diaryId: string, superAdminId: string, reason: string) {
    const sequelize = Diary.sequelize;
    if (!sequelize) {
      throw new Error("Diary database connection is not available");
    }

    const diary = await sequelize.transaction(async (transaction) => {
      const diaryRecord = await Diary.findByPk(diaryId, { transaction });

      if (!diaryRecord) {
        throw new Error("Diary not found");
      }

      if (normalizeDiaryStatus(diaryRecord.status) !== DIARY_STATUS.PENDING) {
        throw new Error("Diary is not pending approval");
      }

      const linkedPatientId = diaryRecord.patientId;

      // Rejected diaries must immediately lose all active links so no role can
      // continue using the old assignment after Super Admin rejection.
      diaryRecord.status = DIARY_STATUS.REJECTED;
      diaryRecord.patientId = null;
      diaryRecord.doctorId = null;
      diaryRecord.approvedBy = undefined;
      diaryRecord.approvedAt = undefined;
      diaryRecord.activationDate = undefined;
      diaryRecord.rejectionReason = reason;
      await diaryRecord.save({ transaction });

      if (linkedPatientId) {
        await Patient.update(
          { diaryId: null },
          {
            where: {
              id: linkedPatientId,
              diaryId,
            },
            transaction,
          }
        );
      }

      // The physical diary goes back to seller inventory after rejection.
      await GeneratedDiary.update(
        { status: "assigned", soldTo: undefined, soldDate: undefined },
        { where: { id: diaryId }, transaction }
      );

      return diaryRecord;
    });

    // Create notification for the seller (soldBy or vendorId for backward compat)
    const rejectionRecipientId = diary.soldBy || diary.vendorId;
    if (rejectionRecipientId) {
      await Notification.create({
        recipientId: rejectionRecipientId,
        recipientType: "staff",
        senderId: superAdminId,
        type: "alert",
        severity: "medium",
        title: "Diary Sale Rejected",
        message: `Your diary sale (${diaryId}) has been rejected. Reason: ${reason}`,
        read: false,
        delivered: true,
      });
    }

    console.info(
      `[DIARY_REJECTION] diaryId=${diaryId} rejectedBy=${superAdminId} status=${diary.status}`
    );

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

    // Resolve who to assign diaries to (requesterId for new requests, vendorId for legacy)
    const assignToUserId = request.requesterId || request.vendorId;
    if (!assignToUserId) {
      throw new Error("Cannot determine who to assign diaries to");
    }

    let diaryIds: string[] = [];

    if (availableDiaries.length >= request.quantity) {
      // Assign existing diaries
      diaryIds = availableDiaries.map((d) => d.id);
      await this.bulkAssignDiaries(diaryIds, assignToUserId);
    } else {
      // Generate new diaries if not enough available
      const needed = request.quantity - availableDiaries.length;
      const generated = await this.generateDiaries(needed);
      const newDiaryIds = generated.diaries.map((d) => d.id);

      // Assign all diaries
      if (availableDiaries.length > 0) {
        await this.bulkAssignDiaries(
          availableDiaries.map((d) => d.id),
          assignToUserId
        );
      }
      await this.bulkAssignDiaries(newDiaryIds, assignToUserId);

      diaryIds = [...availableDiaries.map((d) => d.id), ...newDiaryIds];
    }

    // Update request
    request.status = "fulfilled";
    request.fulfilledDate = new Date();
    request.fulfilledBy = superAdminId;
    request.assignedDiaryIds = diaryIds;
    await request.save();

    // Notify requester
    await Notification.create({
      recipientId: assignToUserId,
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

    // Notify requester
    const rejectRecipientId = request.requesterId || request.vendorId;
    if (rejectRecipientId) {
      await Notification.create({
        recipientId: rejectRecipientId,
        recipientType: "staff",
        senderId: superAdminId,
        type: "alert",
        severity: "medium",
        title: "Diary Request Rejected",
        message: `Your request for ${request.quantity} diaries has been rejected. Reason: ${reason}`,
        read: false,
        delivered: true,
      });
    }

    return request;
  }

  async cancelDiaryRequest(requestId: string, userId: string) {
    const request = await DiaryRequest.findByPk(requestId);

    if (!request) {
      throw new Error("Request not found");
    }

    // Only the requester can cancel their own request
    const requesterId = request.requesterId || request.vendorId;
    if (requesterId !== userId) {
      throw new Error("You can only cancel your own requests");
    }

    if (request.status !== "pending") {
      throw new Error("Only pending requests can be cancelled");
    }

    request.status = "cancelled";
    await request.save();

    return request;
  }

  /**
   * Generate a DOCX file containing all generated diary IDs with their QR codes
   */
  async generateDiariesDoc(diaryIds?: string[]): Promise<Buffer> {
    const whereClause: any = {};
    if (diaryIds && diaryIds.length > 0) {
      whereClause.id = { [Op.in]: diaryIds };
    }

    const diaries = await GeneratedDiary.findAll({
      where: whereClause,
      order: [["createdAt", "ASC"]],
    });

    if (diaries.length === 0) {
      throw new Error("No diaries found");
    }

    const tableBorder = {
      style: BorderStyle.SINGLE,
      size: 1,
      color: "000000",
    };
    const borders = {
      top: tableBorder,
      bottom: tableBorder,
      left: tableBorder,
      right: tableBorder,
    };

    // Build table rows
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 3000, type: WidthType.DXA },
          borders,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "Diary ID", bold: true, size: 24 })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 6000, type: WidthType.DXA },
          borders,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "QR Code Image", bold: true, size: 24 })],
            }),
          ],
        }),
      ],
    });

    // Load the logo once for compositing onto all QR codes
    const logoPath = path.resolve(process.cwd(), "src/assets/QR-logo.png");
    const logoBuffer = await sharp(logoPath)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .extend({
        top: 2,
        bottom: 2,
        left: 2,
        right: 2,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .png()
      .toBuffer();

    const dataRows: TableRow[] = [];
    for (const diary of diaries) {
      // Generate a high-resolution QR code
      const qrSize = 640;
      const qrPngBuffer = await QRCode.toBuffer(diary.id, {
        errorCorrectionLevel: "H",
        width: qrSize,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });

      // Resize logo to ~18% of QR and add a white padding around it
      const logoSize = Math.round(qrSize * 0.18);
      const logoPad = 6;
      const logoResized = await sharp(logoBuffer)
        .resize(logoSize, logoSize, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .extend({
          top: logoPad,
          bottom: logoPad,
          left: logoPad,
          right: logoPad,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png()
        .toBuffer();

      // Composite logo at center of QR code
      const logoWithPadSize = logoSize + logoPad * 2;
      const logoLeft = Math.round((qrSize - logoWithPadSize) / 2);
      const logoTop = Math.round((qrSize - logoWithPadSize) / 2);

      const qrImageData = await sharp(qrPngBuffer)
        .composite([{ input: logoResized, left: logoLeft, top: logoTop }])
        .png()
        .toBuffer();

      dataRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 3000, type: WidthType.DXA },
              borders,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [new TextRun({ text: diary.id, size: 24 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 6000, type: WidthType.DXA },
              borders,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new ImageRun({
                      data: qrImageData,
                      transformation: { width: 250, height: 250 },
                      type: "png",
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
    }

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: "Diary ID and QR Code List", bold: true })],
            }),
            new Paragraph({
              spacing: { after: 300 },
              children: [
                new TextRun({
                  text: `This document is for organising ${diaries.length} Diary IDs and their corresponding QR code images. Each Diary ID will be listed, followed by its associated QR code image.`,
                  size: 22,
                }),
              ],
            }),
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              spacing: { after: 200 },
              children: [new TextRun({ text: "List of Diary IDs and QR Codes", bold: true })],
            }),
            new DocxTable({
              width: { size: 9000, type: WidthType.DXA },
              rows: [headerRow, ...dataRows],
            }),
          ],
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }
}
