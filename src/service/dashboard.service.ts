import { AppUser } from "../models/Appuser";
import { Patient } from "../models/Patient";
import { VendorProfile } from "../models/VendorProfile";
import { GeneratedDiary } from "../models/GeneratedDiary";
import { Diary } from "../models/Diary";
import { Transaction } from "../models/Transaction";
import { ScanLog } from "../models/ScanLog";
import { Task } from "../models/Task";
import { Op } from "sequelize";

class DashboardService {
  /**
   * Super Admin Dashboard Statistics
   */
  async getSuperAdminDashboard() {
    // Total doctors
    const totalDoctors = await AppUser.count({
      where: { role: "DOCTOR" },
    });

    // Total vendors
    const totalVendors = await AppUser.count({
      where: { role: "VENDOR" },
    });

    // Total assistants
    const totalAssistants = await AppUser.count({
      where: { role: "ASSISTANT" },
    });

    // Active diaries (sold and approved)
    const activeDiaries = await Diary.count({
      where: { status: "active" },
    });

    // Pending diary approvals
    const pendingApprovals = await Diary.count({
      where: { status: "pending" },
    });

    // Total patients
    const totalPatients = await Patient.count();

    // Total revenue (sum of all diary sales)
    const revenueData = await Diary.sum("saleAmount", {
      where: { status: { [Op.in]: ["active", "completed"] } },
    });
    const totalRevenue = revenueData || 0;

    // Total commission paid to vendors
    const commissionData = await Diary.sum("commissionAmount", {
      where: { commissionPaid: true },
    });
    const totalCommission = commissionData || 0;

    // Available diaries (unassigned in inventory)
    const availableDiaries = await GeneratedDiary.count({
      where: { status: "unassigned" },
    });

    // This month's stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthDiariesSold = await Diary.count({
      where: {
        createdAt: { [Op.gte]: startOfMonth },
      },
    });

    const thisMonthRevenue = await Diary.sum("saleAmount", {
      where: {
        createdAt: { [Op.gte]: startOfMonth },
        status: { [Op.in]: ["active", "completed"] },
      },
    });

    return {
      users: {
        totalDoctors,
        totalVendors,
        totalAssistants,
        totalPatients,
      },
      diaries: {
        activeDiaries,
        pendingApprovals,
        availableDiaries,
        thisMonthSold: thisMonthDiariesSold,
      },
      financials: {
        totalRevenue: Number(totalRevenue),
        totalCommission: Number(totalCommission),
        thisMonthRevenue: Number(thisMonthRevenue || 0),
        netProfit: Number(totalRevenue) - Number(totalCommission),
      },
    };
  }

  /**
   * Vendor Dashboard Statistics
   */
  async getVendorDashboard(vendorId: string) {
    // Get vendor profile
    const vendor = await VendorProfile.findOne({
      where: { userId: vendorId },
    });

    if (!vendor) {
      throw new Error("Vendor profile not found");
    }

    // Total sales (all diaries sold by this vendor)
    const totalSales = await Diary.count({
      where: { vendorId },
    });

    // Approved sales
    const approvedSales = await Diary.count({
      where: {
        vendorId,
        status: { [Op.in]: ["active", "completed"] },
      },
    });

    // Pending sales (awaiting approval)
    const pendingSales = await Diary.count({
      where: {
        vendorId,
        status: "pending",
      },
    });

    // This month's sales
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthSales = await Diary.count({
      where: {
        vendorId,
        createdAt: { [Op.gte]: startOfMonth },
      },
    });

    // Available diaries (assigned to this vendor)
    const availableDiaries = await GeneratedDiary.count({
      where: {
        assignedTo: vendorId,
        status: "assigned",
      },
    });

    // Total commission earned
    const totalCommissionEarned = await Transaction.sum("amount", {
      where: {
        vendorId,
        type: "commission",
      },
    });

    // Total payouts received
    const totalPayouts = await Transaction.sum("amount", {
      where: {
        vendorId,
        type: "payout",
      },
    });

    // Recent transactions
    const recentTransactions = await Transaction.findAll({
      where: { vendorId },
      order: [["createdAt", "DESC"]],
      limit: 5,
    });

    return {
      sales: {
        total: totalSales,
        approved: approvedSales,
        pending: pendingSales,
        thisMonth: thisMonthSales,
      },
      inventory: {
        available: availableDiaries,
      },
      financials: {
        walletBalance: Number(vendor.walletBalance),
        totalCommissionEarned: Number(totalCommissionEarned || 0),
        totalPayouts: Number(totalPayouts || 0),
        pendingCommission: pendingSales * 50, // ₹50 per pending sale
      },
      recentTransactions,
    };
  }

  /**
   * Doctor Dashboard Statistics
   */
  async getDoctorDashboard(doctorId: string) {
    // Get doctor info
    const doctor = await AppUser.findByPk(doctorId, {
      attributes: ["id", "fullName", "email"],
    });

    // Total patients under this doctor
    const totalPatients = await Patient.count({
      where: { doctorId },
    });

    // Active cases (patients with active diaries)
    let activeCases = 0;
    try {
      activeCases = await Patient.count({
        where: {
          doctorId,
          "$diary.status$": "active",
        },
        include: [
          {
            model: Diary,
            as: "diary",
            required: true,
          },
        ],
      });
    } catch {
      // Diary association may not exist
    }

    // This week's diary entries
    let weekEntries = 0;
    let pendingReviews = 0;
    let flaggedEntries = 0;
    let recentEntries: any[] = [];
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      weekEntries = await ScanLog.count({
        where: {
          doctorId,
          createdAt: { [Op.gte]: oneWeekAgo },
        },
      });

      // Pending reviews (diary entries not reviewed)
      try {
        pendingReviews = await ScanLog.count({
          where: { doctorId, doctorReviewed: false },
        });
      } catch {
        // doctorReviewed column may not exist
      }

      // Flagged entries
      try {
        flaggedEntries = await ScanLog.count({
          where: { doctorId, flagged: true },
        });
      } catch {
        // flagged column may not exist
      }

      // Recent diary entries
      try {
        recentEntries = await ScanLog.findAll({
          where: { doctorId },
          order: [["createdAt", "DESC"]],
          limit: 10,
          include: [
            {
              model: Patient,
              as: "patient",
              attributes: ["id", "name", "phoneNumber"],
            },
          ],
        });
      } catch {
        // patient association may differ
      }
    } catch {
      // ScanLog table may not exist
    }

    // Tasks
    let totalTasks = 0;
    let pendingTasks = 0;
    try {
      totalTasks = await Task.count({
        where: { createdBy: doctorId },
      });
      pendingTasks = await Task.count({
        where: {
          createdBy: doctorId,
          status: { [Op.in]: ["pending", "in-progress"] },
        },
      });
    } catch {
      // Tasks table may not exist
    }

    // Total assistants under this doctor
    const totalAssistants = await AppUser.count({
      where: {
        role: "ASSISTANT",
        parentId: doctorId,
      },
    });

    // Patients needing follow-up
    let patientsNeedingFollowUp = 0;
    try {
      patientsNeedingFollowUp = await Patient.count({
        where: {
          doctorId,
          testCompletionPercentage: { [Op.lt]: 100 },
          totalTestsPrescribed: { [Op.gt]: 0 },
        },
      });
    } catch {
      // These columns may not exist
    }

    return {
      doctorName: doctor?.fullName || null,
      patients: {
        total: totalPatients,
        activeCases,
        needingFollowUp: patientsNeedingFollowUp,
      },
      diaryEntries: {
        thisWeek: weekEntries,
        pendingReviews,
        flagged: flaggedEntries,
      },
      tasks: {
        total: totalTasks,
        pending: pendingTasks,
        completed: totalTasks - pendingTasks,
      },
      team: {
        totalAssistants,
      },
      recentEntries,
    };
  }

  /**
   * Assistant Dashboard Statistics
   */
  async getAssistantDashboard(assistantId: string) {
    // Get assistant info
    const assistant = await AppUser.findByPk(assistantId);

    if (!assistant || assistant.role !== "ASSISTANT") {
      throw new Error("Assistant not found");
    }

    const doctorId = assistant.parentId;

    if (!doctorId) {
      throw new Error("Assistant is not assigned to a doctor");
    }

    // Total patients under the doctor
    const totalPatients = await Patient.count({
      where: { doctorId },
    });

    // Active cases
    const activeCases = await Patient.count({
      where: {
        doctorId,
        "$diary.status$": "active",
      },
      include: [
        {
          model: Diary,
          as: "diary",
          required: true,
        },
      ],
    });

    // Tasks assigned to this assistant
    const totalTasks = await Task.count({
      where: { assignedTo: assistantId },
    });

    // Pending tasks
    const pendingTasks = await Task.count({
      where: {
        assignedTo: assistantId,
        status: "pending",
      },
    });

    // In-progress tasks
    const inProgressTasks = await Task.count({
      where: {
        assignedTo: assistantId,
        status: "in-progress",
      },
    });

    // Completed tasks
    const completedTasks = await Task.count({
      where: {
        assignedTo: assistantId,
        status: "completed",
      },
    });

    // Overdue tasks
    const overdueTasks = await Task.count({
      where: {
        assignedTo: assistantId,
        status: { [Op.in]: ["pending", "in-progress"] },
        dueDate: { [Op.lt]: new Date() },
      },
    });

    // Recent tasks
    const recentTasks = await Task.findAll({
      where: { assignedTo: assistantId },
      order: [["createdAt", "DESC"]],
      limit: 10,
    });

    // Patients needing follow-up calls
    const patientsNeedingCalls = await Patient.count({
      where: {
        doctorId,
        lastDoctorContact: {
          [Op.or]: [
            { [Op.is]: null },
            { [Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // 7 days ago
          ],
        },
      },
    });

    return {
      patients: {
        total: totalPatients,
        activeCases,
        needingCalls: patientsNeedingCalls,
      },
      tasks: {
        total: totalTasks,
        pending: pendingTasks,
        inProgress: inProgressTasks,
        completed: completedTasks,
        overdue: overdueTasks,
      },
      recentTasks,
      permissions: assistant.permissions || {},
    };
  }

  async getAllSuperAdmins() {
    const getSuperAdmins = await AppUser.findAll({
      where: { role: "SUPER_ADMIN" },
      attributes: ["id", "fullName", "email","phone", "createdAt"],
    });
    return getSuperAdmins;
  }
}

export const dashboardService = new DashboardService();
