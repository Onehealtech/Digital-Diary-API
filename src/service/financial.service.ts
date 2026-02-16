import { Transaction } from "../models/Transaction";
import { VendorProfile } from "../models/VendorProfile";
import { AppUser } from "../models/Appuser";
import { Diary } from "../models/Diary";
import { Op } from "sequelize";

interface TransactionFilters {
  page?: number;
  limit?: number;
  type?: string;
  startDate?: Date;
  endDate?: Date;
  vendorId?: string;
}

interface PayoutData {
  vendorId: string;
  amount: number;
  paymentMethod: string;
  description?: string;
}

class FinancialService {
  /**
   * Get financial dashboard for Super Admin
   * Shows overall revenue, commissions, payouts
   */
  async getFinancialDashboard() {
    // Total revenue from diary sales
    const totalRevenue = await Diary.sum("saleAmount", {
      where: { status: { [Op.in]: ["active", "completed"] } },
    });

    // Total commission paid
    const totalCommissionPaid = await Transaction.sum("amount", {
      where: { type: "commission" },
    });

    // Total payouts to vendors
    const totalPayouts = await Transaction.sum("amount", {
      where: { type: "payout" },
    });

    // Pending commission (approved sales but commission not paid)
    const pendingCommissionCount = await Diary.count({
      where: {
        status: "active",
        commissionPaid: false,
      },
    });

    const pendingCommissionAmount = pendingCommissionCount * 50; // ₹50 per diary

    // This month's stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthRevenue = await Diary.sum("saleAmount", {
      where: {
        createdAt: { [Op.gte]: startOfMonth },
        status: { [Op.in]: ["active", "completed"] },
      },
    });

    const thisMonthCommission = await Transaction.sum("amount", {
      where: {
        type: "commission",
        createdAt: { [Op.gte]: startOfMonth },
      },
    });

    const thisMonthPayouts = await Transaction.sum("amount", {
      where: {
        type: "payout",
        createdAt: { [Op.gte]: startOfMonth },
      },
    });

    // Recent transactions
    const recentTransactions = await Transaction.findAll({
      order: [["createdAt", "DESC"]],
      limit: 10,
      include: [
        {
          model: AppUser,
          as: "vendor",
          attributes: ["id", "fullName", "phoneNumber"],
        },
      ],
    });

    // Vendor wallet balances summary
    const vendorBalances = await VendorProfile.findAll({
      attributes: ["userId", "walletBalance"],
      order: [["walletBalance", "DESC"]],
      limit: 10,
      include: [
        {
          model: AppUser,
          as: "user",
          attributes: ["id", "fullName", "phoneNumber"],
        },
      ],
    });

    return {
      overview: {
        totalRevenue: Number(totalRevenue || 0),
        totalCommissionPaid: Number(totalCommissionPaid || 0),
        totalPayouts: Number(totalPayouts || 0),
        pendingCommission: pendingCommissionAmount,
        netProfit: Number(totalRevenue || 0) - Number(totalCommissionPaid || 0),
      },
      thisMonth: {
        revenue: Number(thisMonthRevenue || 0),
        commission: Number(thisMonthCommission || 0),
        payouts: Number(thisMonthPayouts || 0),
      },
      recentTransactions,
      topVendorBalances: vendorBalances,
    };
  }

  /**
   * Get all transactions with filters
   */
  async getAllTransactions(filters: TransactionFilters = {}) {
    const {
      page = 1,
      limit = 20,
      type,
      startDate,
      endDate,
      vendorId,
    } = filters;

    const offset = (page - 1) * limit;

    const whereClause: any = {};

    if (type) {
      whereClause.type = type;
    }

    if (vendorId) {
      whereClause.vendorId = vendorId;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt[Op.gte] = startDate;
      }
      if (endDate) {
        whereClause.createdAt[Op.lte] = endDate;
      }
    }

    const { rows: transactions, count: total } = await Transaction.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: AppUser,
          as: "vendor",
          attributes: ["id", "fullName", "phoneNumber", "email"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    return {
      transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Process payout to vendor
   */
  async processPayout(superAdminId: string, payoutData: PayoutData) {
    // Get vendor profile
    const vendorProfile = await VendorProfile.findOne({
      where: { userId: payoutData.vendorId },
    });

    if (!vendorProfile) {
      throw new Error("Vendor profile not found");
    }

    // Check if sufficient balance
    if (vendorProfile.walletBalance < payoutData.amount) {
      throw new Error(
        `Insufficient balance. Available: ₹${vendorProfile.walletBalance}, Requested: ₹${payoutData.amount}`
      );
    }

    // Deduct from wallet
    const balanceBefore = vendorProfile.walletBalance;
    const balanceAfter = balanceBefore - payoutData.amount;

    await vendorProfile.update({
      walletBalance: balanceAfter,
    });

    // Create transaction record
    const transaction = await Transaction.create({
      vendorId: payoutData.vendorId,
      type: "payout",
      amount: payoutData.amount,
      balanceBefore,
      balanceAfter,
      description: payoutData.description || "Payout to vendor",
      paymentMethod: payoutData.paymentMethod,
      processedBy: superAdminId,
    });

    return {
      transaction,
      newBalance: balanceAfter,
    };
  }

  /**
   * Get financial statement for a vendor
   */
  async getVendorStatement(
    vendorId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const whereClause: any = { vendorId };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt[Op.gte] = startDate;
      }
      if (endDate) {
        whereClause.createdAt[Op.lte] = endDate;
      }
    }

    const transactions = await Transaction.findAll({
      where: whereClause,
      order: [["createdAt", "ASC"]],
    });

    // Get vendor profile for current balance
    const vendorProfile = await VendorProfile.findOne({
      where: { userId: vendorId },
      include: [
        {
          model: AppUser,
          as: "user",
          attributes: ["id", "fullName", "email", "phoneNumber"],
        },
      ],
    });

    if (!vendorProfile) {
      throw new Error("Vendor profile not found");
    }

    // Calculate totals by type
    const sales = transactions.filter((t) => t.type === "sale");
    const commissions = transactions.filter((t) => t.type === "commission");
    const payouts = transactions.filter((t) => t.type === "payout");
    const refunds = transactions.filter((t) => t.type === "refund");

    const totalSales = sales.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalCommissions = commissions.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );
    const totalPayouts = payouts.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalRefunds = refunds.reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      vendor: {
        id: (vendorProfile as any).userId,
        name: (vendorProfile as any).user?.fullName,
        email: (vendorProfile as any).user?.email,
        phoneNumber: (vendorProfile as any).user?.phoneNumber,
        currentBalance: Number(vendorProfile.walletBalance),
      },
      period: {
        startDate,
        endDate,
      },
      summary: {
        totalSales,
        totalCommissions,
        totalPayouts,
        totalRefunds,
        netEarnings: totalCommissions - totalPayouts,
      },
      transactions,
    };
  }

  /**
   * Auto-credit commission (internal use)
   * Called when diary sale is approved
   */
  async autoCreditCommission(
    vendorId: string,
    diaryId: string,
    commissionAmount: number
  ) {
    // Get vendor profile
    const vendorProfile = await VendorProfile.findOne({
      where: { userId: vendorId },
    });

    if (!vendorProfile) {
      throw new Error("Vendor profile not found");
    }

    // Credit commission to wallet
    const balanceBefore = vendorProfile.walletBalance;
    const balanceAfter = balanceBefore + commissionAmount;

    await vendorProfile.update({
      walletBalance: balanceAfter,
    });

    // Create transaction record
    const transaction = await Transaction.create({
      vendorId,
      type: "commission",
      amount: commissionAmount,
      balanceBefore,
      balanceAfter,
      diaryId,
      description: `Commission for diary sale ${diaryId}`,
    });

    return {
      transaction,
      newBalance: balanceAfter,
    };
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStats(vendorId?: string) {
    const whereClause = vendorId ? { vendorId } : {};

    const total = await Transaction.count({ where: whereClause });

    const byType = await Transaction.findAll({
      where: whereClause,
      attributes: [
        "type",
        [Transaction.sequelize!.fn("COUNT", "*"), "count"],
        [Transaction.sequelize!.fn("SUM", Transaction.sequelize!.col("amount")), "total"],
      ],
      group: ["type"],
      raw: true,
    });

    return {
      total,
      byType,
    };
  }
}

export const financialService = new FinancialService();
