import { AppUser } from "../models/Appuser";
import { VendorProfile } from "../models/VendorProfile";
import { Patient } from "../models/Patient";
import { Diary } from "../models/Diary";
import { Transaction } from "../models/Transaction";
import { GeneratedDiary } from "../models/GeneratedDiary";
import { Op } from "sequelize";
import bcrypt from "bcrypt";
import { DiaryTemplate, TemplateField, TemplateJson, TemplatePage } from "../models/DiaryTemplate";
import { getVendorDashboard } from "../controllers/dashboard.controller";

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
export class VendorService {
 
  /**
   * Get all vendors with pagination and filters
   */
  async getAllVendors(params: {
    page?: number;
    limit?: number;
    search?: string;
    location?: string;
    status?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const offset = (page - 1) * limit;

    const whereClause: any = { role: "VENDOR" };

    if (params.search) {
      whereClause[Op.or] = [
        { fullName: { [Op.iLike]: `%${params.search}%` } },
        { email: { [Op.iLike]: `%${params.search}%` } },
      ];
    }

    const vendors = await AppUser.findAndCountAll({
      where: whereClause,
      // include: [
      //   {
      //     model: VendorProfile,
      //     as: "vendorProfile",
      //     where: params.status ? { status: params.status } : undefined,
      //     required: false,
      //   },
      // ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    return {
      data: vendors.rows,
      total: vendors.count,
      page,
      limit,
      totalPages: Math.ceil(vendors.count / limit),
    };
  }

  /**
   * Get vendor by ID with profile
   */
  async getVendorById(vendorId: string) {
    const vendor = await AppUser.findOne({
      where: { id: vendorId, role: "VENDOR" },
      include: [
        {
          model: VendorProfile,
          as: "vendorProfile",
        },
      ],
    });

    if (!vendor) {
      throw new Error("Vendor not found");
    }

    return vendor;
  }

  /**
   * Create new vendor
   */
  async createVendor(data: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
    businessName: string;
    location: string;
    gst: string;
    bankDetails: {
      accountNumber: string;
      ifscCode: string;
      accountHolderName: string;
      bankName: string;
    };
    commissionRate?: number;
  }) {
    // Check if email already exists
    const existingUser = await AppUser.findOne({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error("Email already exists");
    }

    // Create AppUser
    const vendor = await AppUser.create({
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      password: data.password, // Will be hashed by BeforeCreate hook
      role: "VENDOR",
    });

    // Create VendorProfile
    const vendorProfile = await VendorProfile.create({
      vendorId: vendor.id,
      businessName: data.businessName,
      location: data.location,
      gst: data.gst,
      bankDetails: data.bankDetails,
      commissionRate: data.commissionRate || 50,
      status: "active",
    });

    return { vendor, vendorProfile };
  }

  /**
   * Update vendor profile
   */
  async updateVendor(
    vendorId: string,
    data: {
      fullName?: string;
      phone?: string;
      businessName?: string;
      location?: string;
      bankDetails?: any;
      commissionRate?: number;
      status?: string;
    }
  ) {
    const vendor = await AppUser.findOne({
      where: { id: vendorId, role: "VENDOR" },
    });

    if (!vendor) {
      throw new Error("Vendor not found");
    }

    // Update AppUser fields
    if (data.fullName) vendor.fullName = data.fullName;
    if (data.phone) vendor.phone = data.phone;
    await vendor.save();

    // Update VendorProfile
    const vendorProfile = await VendorProfile.findOne({
      where: { vendorId },
    });

    if (vendorProfile) {
      if (data.businessName) vendorProfile.businessName = data.businessName;
      if (data.location) vendorProfile.location = data.location;
      if (data.bankDetails) vendorProfile.bankDetails = data.bankDetails;
      if (data.commissionRate !== undefined)
        vendorProfile.commissionRate = data.commissionRate;
      if (data.status) vendorProfile.status = data.status as any;
      await vendorProfile.save();
    }

    return { vendor, vendorProfile };
  }

  /**
   * Get vendor wallet and transactions
   */
  async getVendorWallet(vendorId: string, page: number = 1, limit: number = 20) {
    const vendorProfile = await VendorProfile.findOne({
      where: { vendorId },
    });

    if (!vendorProfile) {
      throw new Error("Vendor profile not found");
    }

    const offset = (page - 1) * limit;

    const transactions = await Transaction.findAndCountAll({
      where: { vendorId },
      limit,
      offset,
      order: [["timestamp", "DESC"]],
    });

    return {
      walletBalance: vendorProfile.walletBalance,
      transactions: transactions.rows,
      total: transactions.count,
      page,
      limit,
      totalPages: Math.ceil(transactions.count / limit),
    };
  }

  /**
   * Transfer funds to vendor wallet
   */
  async transferFunds(
    vendorId: string,
    amount: number,
    processedBy: string,
    description?: string
  ) {
    const vendorProfile = await VendorProfile.findOne({
      where: { vendorId },
    });

    if (!vendorProfile) {
      throw new Error("Vendor profile not found");
    }

    const balanceBefore = parseFloat(vendorProfile.walletBalance.toString());
    const balanceAfter = balanceBefore + amount;

    // Create transaction record
    const transaction = await Transaction.create({
      vendorId,
      type: "payout",
      amount,
      balanceBefore,
      balanceAfter,
      description: description || "Commission payout",
      processedBy,
      timestamp: new Date(),
    });

    // Update wallet balance
    vendorProfile.walletBalance = balanceAfter;
    await vendorProfile.save();

    return { transaction, newBalance: balanceAfter };
  }

  /**
   * Get vendor sales history
   */
  async getVendorSales(
    vendorId: string,
    params: {
      page?: number;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
      status?: string;
    }
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const whereClause: any = { vendorId };

    if (params.startDate && params.endDate) {
      whereClause.createdAt = {
        [Op.between]: [params.startDate, params.endDate],
      };
    }

    if (params.status) {
      whereClause.status = params.status;
    }

    const sales = await Diary.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Patient,
          as: "patient",
        },
        {
          model: AppUser,
          as: "doctor",
        },
        {
          model: AppUser,
          as: "vendor",
        },
      ],
      limit,
      offset,
      order: [["createdAt", "DESC"]],
    });

    // Calculate stats
    const vendorProfile = await AppUser.findOne({
      where: { id: vendorId, role: "VENDOR" },
    });

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const thisMonthSales = await Diary.count({
      where: {
        vendorId,
        createdAt: { [Op.gte]: thisMonth },
      },
    });

    return {
      sales: sales.rows,
      total: sales.count,
      page,
      limit,
      totalPages: Math.ceil(sales.count / limit),
      stats: {
        totalSales: vendorProfile || 0,
        thisMonthSales,
        commission: vendorProfile || 0,
      },
    };
  }

  /**
   * Get vendor inventory (assigned diaries)
   */
  async getVendorInventory(
    vendorId: string,
    params: {
      page?: number;
      limit?: number;
      status?: string;
    }
  ) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    const whereClause: any = { assignedTo: vendorId };

    if (params.status) {
      whereClause.status = params.status;
    }

    const inventory = await GeneratedDiary.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [["assignedDate", "DESC"]],
    });

    // Calculate stats
    const totalAssigned = await GeneratedDiary.count({
      where: { assignedTo: vendorId },
    });

    const available = await GeneratedDiary.count({
      where: { assignedTo: vendorId, status: "assigned" },
    });

    const sold = await GeneratedDiary.count({
      where: { assignedTo: vendorId, status: { [Op.in]: ["sold", "active"] } },
    });

    return {
      diaries: inventory.rows,
      total: inventory.count,
      page,
      limit,
      totalPages: Math.ceil(inventory.count / limit),
      stats: {
        totalAssigned,
        available,
        sold,
      },
    };
  }

  /**
   * Sell diary to patient
   */
  async sellDiary(data: {
    vendorId: string;
    diaryId: string;
    patientName: string;
    age: number;
    gender: string;
    phone: string;
    address: string;
    doctorId: string;
    paymentAmount: number;
  }) {
    // Check if diary exists and is assigned to this vendor
    const generatedDiary = await GeneratedDiary.findOne({
      where: {
        id: data.diaryId,
        assignedTo: data.vendorId,
        status: "assigned",
      },
    });

    if (!generatedDiary) {
      throw new Error("Diary not found or not available for sale");
    }

    // Create patient record
    const patient = await Patient.create({
      stickerId: data.diaryId, // Use diary ID as sticker ID
      fullName: data.patientName,
      age: data.age,
      gender: data.gender,
      phone: data.phone,
      address: data.address,
      diaryId: data.diaryId,
      vendorId: data.vendorId,
      doctorId: data.doctorId,
      status: "ACTIVE",
      registeredDate: new Date(),
    });
    let diaryTypeTemplate: string = ""; 
    if (generatedDiary.diaryType == "peri-operative") {
      diaryTypeTemplate = "PERI-OPERATIVE";
    }
    const generatedTemplate:any = await DiaryTemplate.findOne({ where: { code: diaryTypeTemplate } });
     const diaryInstance = buildDiaryInstance(generatedTemplate.templateData)
    // Create diary record (pending approval)
    const diary = await Diary.create({
      id: data.diaryId,
      templateId: generatedTemplate ? generatedTemplate.id : null,
      patientId: patient.id,
      doctorId: data.doctorId,
      vendorId: data.vendorId,
      diaryType: generatedDiary.diaryType,
      status: "pending",
      saleAmount: data.paymentAmount,
      diaryData:diaryInstance,
      commissionAmount: 50, // ₹50 commission
      commissionPaid: false,
    });

    // Update generated diary status
    generatedDiary.status = "sold";
    generatedDiary.soldTo = patient.id;
    generatedDiary.soldDate = new Date();
    await generatedDiary.save();

    return { patient, diary };
  }

  /**
   * Get vendor dashboard statistics
   */
  async getVendorDashboard(vendorId: string) {
    const vendorProfile = await VendorProfile.findOne({
      where: { vendorId },
    });

    if (!vendorProfile) {
      throw new Error("Vendor profile not found");
    }

    // Calculate this month's sales
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const thisMonthSales = await Diary.count({
      where: {
        vendorId,
        createdAt: { [Op.gte]: thisMonth },
      },
    });

    // Get available diaries count
    const availableDiaries = await GeneratedDiary.count({
      where: {
        assignedTo: vendorId,
        status: "assigned",
      },
    });

    // Get active diaries count
    const activeDiaries = await Diary.count({
      where: {
        vendorId,
        status: "active",
      },
    });

    // Get recent sales
    const recentSales = await Diary.findAll({
      where: { vendorId },
      include: [{ model: Patient, as: "patient" }],
      limit: 10,
      order: [["createdAt", "DESC"]],
    });

    return {
      stats: {
        totalSales: vendorProfile.diariesSold,
        thisMonthSales,
        walletBalance: vendorProfile.walletBalance,
        availableDiaries,
        activeDiaries,
      },
      recentSales,
    };
  }
}
