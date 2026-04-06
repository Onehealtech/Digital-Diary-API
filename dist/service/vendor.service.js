"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorService = void 0;
const Appuser_1 = require("../models/Appuser");
const VendorProfile_1 = require("../models/VendorProfile");
const Patient_1 = require("../models/Patient");
const Diary_1 = require("../models/Diary");
const Transaction_1 = require("../models/Transaction");
const GeneratedDiary_1 = require("../models/GeneratedDiary");
const sequelize_1 = require("sequelize");
const diaryStatus_1 = require("../utils/diaryStatus");
class VendorService {
    /**
     * Get all vendors with pagination and filters
     */
    async getAllVendors(params) {
        const page = params.page || 1;
        const limit = params.limit || 10;
        const offset = (page - 1) * limit;
        const whereClause = { role: "VENDOR" };
        if (params.search) {
            whereClause[sequelize_1.Op.or] = [
                { fullName: { [sequelize_1.Op.iLike]: `%${params.search}%` } },
                { email: { [sequelize_1.Op.iLike]: `%${params.search}%` } },
            ];
        }
        const vendors = await Appuser_1.AppUser.findAndCountAll({
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
    async getVendorById(vendorId) {
        const vendor = await Appuser_1.AppUser.findOne({
            where: { id: vendorId, role: "VENDOR" },
            include: [
                {
                    model: VendorProfile_1.VendorProfile,
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
    async createVendor(data) {
        // Check if email already exists
        const existingUser = await Appuser_1.AppUser.findOne({
            where: { email: data.email },
        });
        if (existingUser) {
            throw new Error("Email already exists");
        }
        // Create AppUser
        const vendor = await Appuser_1.AppUser.create({
            fullName: data.fullName,
            email: data.email,
            phone: data.phone,
            password: data.password,
            role: "VENDOR",
            address: data.address,
            city: data.city,
            state: data.state,
        });
        // Create VendorProfile
        const vendorProfile = await VendorProfile_1.VendorProfile.create({
            vendorId: vendor.id,
            businessName: data.businessName,
            address: data.address,
            city: data.city,
            state: data.state,
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
    async updateVendor(vendorId, data) {
        const vendor = await Appuser_1.AppUser.findOne({
            where: { id: vendorId, role: "VENDOR" },
        });
        if (!vendor) {
            throw new Error("Vendor not found");
        }
        // Update AppUser fields
        if (data.fullName)
            vendor.fullName = data.fullName;
        if (data.phone)
            vendor.phone = data.phone;
        if (data.address)
            vendor.address = data.address;
        if (data.city)
            vendor.city = data.city;
        if (data.state)
            vendor.state = data.state;
        await vendor.save();
        // Update VendorProfile
        const vendorProfile = await VendorProfile_1.VendorProfile.findOne({
            where: { vendorId },
        });
        if (vendorProfile) {
            if (data.businessName)
                vendorProfile.businessName = data.businessName;
            if (data.address)
                vendorProfile.address = data.address;
            if (data.city)
                vendorProfile.city = data.city;
            if (data.state)
                vendorProfile.state = data.state;
            if (data.bankDetails)
                vendorProfile.bankDetails = data.bankDetails;
            if (data.commissionRate !== undefined)
                vendorProfile.commissionRate = data.commissionRate;
            if (data.status)
                vendorProfile.status = data.status;
            await vendorProfile.save();
        }
        return { vendor, vendorProfile };
    }
    /**
     * Get vendor wallet and transactions
     */
    async getVendorWallet(vendorId, page = 1, limit = 20) {
        const vendorProfile = await VendorProfile_1.VendorProfile.findOne({
            where: { vendorId },
        });
        if (!vendorProfile) {
            throw new Error("Vendor profile not found");
        }
        const offset = (page - 1) * limit;
        const transactions = await Transaction_1.Transaction.findAndCountAll({
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
    async transferFunds(vendorId, amount, processedBy, description) {
        const vendorProfile = await VendorProfile_1.VendorProfile.findOne({
            where: { vendorId },
        });
        if (!vendorProfile) {
            throw new Error("Vendor profile not found");
        }
        const balanceBefore = parseFloat(vendorProfile.walletBalance.toString());
        const balanceAfter = balanceBefore + amount;
        // Create transaction record
        const transaction = await Transaction_1.Transaction.create({
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
    async getVendorSales(vendorId, params) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const offset = (page - 1) * limit;
        const whereClause = { vendorId };
        if (params.startDate && params.endDate) {
            whereClause.createdAt = {
                [sequelize_1.Op.between]: [params.startDate, params.endDate],
            };
        }
        if (params.status) {
            whereClause.status = (0, diaryStatus_1.normalizeDiaryStatus)(params.status);
        }
        const sales = await Diary_1.Diary.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Patient_1.Patient,
                    as: "patient",
                },
                {
                    model: Appuser_1.AppUser,
                    as: "doctor",
                },
                {
                    model: Appuser_1.AppUser,
                    as: "vendor",
                },
            ],
            limit,
            offset,
            order: [["createdAt", "DESC"]],
        });
        // Enrich each sale with diaryType from GeneratedDiary (Diary.id === GeneratedDiary.id)
        const diaryIds = sales.rows.map((s) => s.id);
        const generatedDiaries = await GeneratedDiary_1.GeneratedDiary.findAll({
            where: { id: diaryIds },
            attributes: ["id", "diaryType"],
        });
        const diaryTypeMap = {};
        generatedDiaries.forEach((gd) => {
            diaryTypeMap[gd.id] = gd.diaryType;
        });
        const salesWithType = sales.rows.map((s) => ({
            ...s.toJSON(),
            diaryType: diaryTypeMap[s.id] || null,
        }));
        // Calculate stats
        const vendorProfile = await Appuser_1.AppUser.findOne({
            where: { id: vendorId, role: "VENDOR" },
        });
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        const thisMonthSales = await Diary_1.Diary.count({
            where: {
                vendorId,
                createdAt: { [sequelize_1.Op.gte]: thisMonth },
            },
        });
        console.info(`[DIARY_FETCH] scope=vendor_sales vendorId=${vendorId} total=${sales.count}`);
        return {
            sales: salesWithType,
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
    async getVendorInventory(vendorId, params) {
        const page = params.page || 1;
        const limit = params.limit || 50;
        const offset = (page - 1) * limit;
        const whereClause = { assignedTo: vendorId };
        if (params.status) {
            whereClause.status = params.status;
        }
        const inventory = await GeneratedDiary_1.GeneratedDiary.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            order: [["assignedDate", "DESC"]],
        });
        // Calculate stats
        const totalAssigned = await GeneratedDiary_1.GeneratedDiary.count({
            where: { assignedTo: vendorId },
        });
        const available = await GeneratedDiary_1.GeneratedDiary.count({
            where: { assignedTo: vendorId, status: "assigned" },
        });
        const sold = await GeneratedDiary_1.GeneratedDiary.count({
            where: { assignedTo: vendorId, status: { [sequelize_1.Op.in]: ["sold", "active"] } },
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
    async sellDiary(data) {
        // Check if diary exists and is assigned to this vendor
        const generatedDiary = await GeneratedDiary_1.GeneratedDiary.findOne({
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
        const patient = await Patient_1.Patient.create({
            stickerId: data.diaryId,
            fullName: data.patientName,
            age: data.age,
            gender: data.gender,
            phone: data.phone,
            address: data.address,
            diaryId: data.diaryId,
            vendorId: data.vendorId,
            doctorId: data.doctorId,
            caseType: "PERI_OPERATIVE",
            status: "ACTIVE",
            registeredDate: new Date(),
        });
        // Create diary record (pending approval)
        const diary = await Diary_1.Diary.create({
            id: data.diaryId,
            patientId: patient.id,
            doctorId: data.doctorId,
            vendorId: data.vendorId,
            status: diaryStatus_1.DIARY_STATUS.PENDING,
            saleAmount: data.paymentAmount,
            commissionAmount: 50,
            commissionPaid: false,
        });
        // Update generated diary status
        generatedDiary.status = "sold";
        generatedDiary.soldTo = patient.id;
        generatedDiary.soldDate = new Date();
        await generatedDiary.save();
        console.info(`[DIARY_CREATE] scope=vendor_service vendorId=${data.vendorId} diaryId=${data.diaryId} status=${diary.status}`);
        return { patient, diary };
    }
    /**
     * Mark a diary sale as fund-transferred
     */
    async markFundTransferred(diaryId, vendorId) {
        const diary = await Diary_1.Diary.findOne({
            where: { id: diaryId, vendorId },
        });
        if (!diary) {
            throw new Error("Sale record not found");
        }
        if (diary.fundTransferred) {
            throw new Error("Funds already transferred for this sale");
        }
        diary.fundTransferred = true;
        await diary.save();
        return { message: "Sale marked as fund transferred", diaryId };
    }
    /**
     * Get vendor dashboard statistics
     */
    async getVendorDashboard(vendorId) {
        const vendorProfile = await VendorProfile_1.VendorProfile.findOne({
            where: { vendorId },
        });
        if (!vendorProfile) {
            throw new Error("Vendor profile not found");
        }
        // Calculate this month's sales
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        const thisMonthSales = await Diary_1.Diary.count({
            where: {
                vendorId,
                createdAt: { [sequelize_1.Op.gte]: thisMonth },
            },
        });
        // Get available diaries count
        const availableDiaries = await GeneratedDiary_1.GeneratedDiary.count({
            where: {
                assignedTo: vendorId,
                status: "assigned",
            },
        });
        // Get approved diaries count (kept variable name for response compatibility)
        const activeDiaries = await Diary_1.Diary.count({
            where: {
                vendorId,
                status: diaryStatus_1.DIARY_STATUS.APPROVED,
            },
        });
        // Get recent sales
        const recentSales = await Diary_1.Diary.findAll({
            where: { vendorId },
            include: [{ model: Patient_1.Patient, as: "patient" }],
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
exports.VendorService = VendorService;
