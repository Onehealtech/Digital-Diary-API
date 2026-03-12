"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardService = void 0;
const Appuser_1 = require("../models/Appuser");
const Patient_1 = require("../models/Patient");
const GeneratedDiary_1 = require("../models/GeneratedDiary");
const Diary_1 = require("../models/Diary");
const ScanLog_1 = require("../models/ScanLog");
const Task_1 = require("../models/Task");
const sequelize_1 = require("sequelize");
class DashboardService {
    /**
     * Super Admin Dashboard Statistics
     */
    async getSuperAdminDashboard() {
        // Total doctors
        const totalDoctors = await Appuser_1.AppUser.count({
            where: { role: "DOCTOR" },
        });
        // Total vendors
        const totalVendors = await Appuser_1.AppUser.count({
            where: { role: "VENDOR" },
        });
        // Total assistants
        const totalAssistants = await Appuser_1.AppUser.count({
            where: { role: "ASSISTANT" },
        });
        // Active diaries (sold and approved)
        const activeDiaries = await Diary_1.Diary.count({
            where: { status: "active" },
        });
        // Pending diary approvals
        const pendingApprovals = await Diary_1.Diary.count({
            where: { status: "pending" },
        });
        // Total patients
        const totalPatients = await Patient_1.Patient.count();
        // Total revenue (sum of all diary sales)
        const revenueData = await Diary_1.Diary.sum("saleAmount", {
            where: { status: { [sequelize_1.Op.in]: ["active", "completed"] } },
        });
        const totalRevenue = revenueData || 0;
        // Total commission paid to vendors
        const commissionData = await Diary_1.Diary.sum("commissionAmount", {
            where: { commissionPaid: true },
        });
        const totalCommission = commissionData || 0;
        // Available diaries (unassigned in inventory)
        const availableDiaries = await GeneratedDiary_1.GeneratedDiary.count({
            where: { status: "unassigned" },
        });
        // This month's stats
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const thisMonthDiariesSold = await Diary_1.Diary.count({
            where: {
                createdAt: { [sequelize_1.Op.gte]: startOfMonth },
            },
        });
        const thisMonthRevenue = await Diary_1.Diary.sum("saleAmount", {
            where: {
                createdAt: { [sequelize_1.Op.gte]: startOfMonth },
                status: { [sequelize_1.Op.in]: ["active", "completed"] },
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
    async getVendorDashboard(vendorId) {
        // Get vendor profile
        // const vendor = await VendorProfile.findOne({
        //   where: { vendorId: vendorId },
        // });
        // if (!vendor) {
        //   throw new Error("Vendor profile not found");
        // }
        // Total sales (all diaries sold by this vendor)
        const totalSales = await Diary_1.Diary.count({
            where: { vendorId },
        });
        // Approved sales
        const approvedSales = await Diary_1.Diary.count({
            where: {
                vendorId,
                status: { [sequelize_1.Op.in]: ["active", "completed"] },
            },
        });
        // Pending sales (awaiting approval)
        const pendingSales = await Diary_1.Diary.count({
            where: {
                vendorId,
                status: "pending",
            },
        });
        // This month's sales
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const thisMonthSales = await Diary_1.Diary.count({
            where: {
                vendorId,
                createdAt: { [sequelize_1.Op.gte]: startOfMonth },
            },
        });
        // Available diaries (assigned to this vendor)
        const availableDiaries = await GeneratedDiary_1.GeneratedDiary.count({
            where: {
                assignedTo: vendorId,
                status: "assigned",
            },
        });
        // Total commission earned
        // const totalCommissionEarned = await Transaction.sum("amount", {
        //   where: {
        //     vendorId,
        //     type: "commission",
        //   },
        // });
        // // Total payouts received
        // const totalPayouts = await Transaction.sum("amount", {
        //   where: {
        //     vendorId,
        //     type: "payout",
        //   },
        // });
        // // Recent transactions
        // const recentTransactions = await Transaction.findAll({
        //   where: { vendorId },
        //   order: [["createdAt", "DESC"]],
        //   limit: 5,
        // });
        // const recentTransactions = await Transaction.findAll({
        //   where: { vendorId },
        //   order: [["createdAt", "DESC"]],
        //   limit: 5,
        // });
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
            // financials: {
            // walletBalance: Number(vendor.walletBalance),
            // totalCommissionEarned: Number(totalCommissionEarned || 0),
            // totalPayouts: Number(totalPayouts || 0),
            // pendingCommission: pendingSales, // ₹50 per pending sale
            // },
            // recentTransactions,
        };
    }
    /**
     * Doctor Dashboard Statistics
     */
    async getDoctorDashboard(doctorId) {
        // Get doctor info
        const doctor = await Appuser_1.AppUser.findByPk(doctorId, {
            attributes: ["id", "fullName", "email"],
        });
        // Total patients under this doctor
        const totalPatients = await Patient_1.Patient.count({
            where: { doctorId },
        });
        // Active cases (patients with active diaries)
        let activeCases = 0;
        try {
            activeCases = await Patient_1.Patient.count({
                where: {
                    doctorId,
                    "$diary.status$": "active",
                },
                include: [
                    {
                        model: Diary_1.Diary,
                        as: "diary",
                        required: true,
                    },
                ],
            });
        }
        catch {
            // Diary association may not exist
        }
        // This week's diary entries
        let weekEntries = 0;
        let pendingReviews = 0;
        let flaggedEntries = 0;
        let recentEntries = [];
        try {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            weekEntries = await ScanLog_1.ScanLog.count({
                where: {
                    doctorId,
                    createdAt: { [sequelize_1.Op.gte]: oneWeekAgo },
                },
            });
            // Pending reviews (diary entries not reviewed)
            try {
                pendingReviews = await ScanLog_1.ScanLog.count({
                    where: { doctorId, doctorReviewed: false },
                });
            }
            catch {
                // doctorReviewed column may not exist
            }
            // Flagged entries
            try {
                flaggedEntries = await ScanLog_1.ScanLog.count({
                    where: { doctorId, flagged: true },
                });
            }
            catch {
                // flagged column may not exist
            }
            // Recent diary entries
            try {
                recentEntries = await ScanLog_1.ScanLog.findAll({
                    where: { doctorId },
                    order: [["createdAt", "DESC"]],
                    limit: 10,
                    include: [
                        {
                            model: Patient_1.Patient,
                            as: "patient",
                            attributes: ["id", "name", "phoneNumber"],
                        },
                    ],
                });
            }
            catch {
                // patient association may differ
            }
        }
        catch {
            // ScanLog table may not exist
        }
        // Tasks
        let totalTasks = 0;
        let pendingTasks = 0;
        try {
            totalTasks = await Task_1.Task.count({
                where: { createdBy: doctorId },
            });
            pendingTasks = await Task_1.Task.count({
                where: {
                    createdBy: doctorId,
                    status: { [sequelize_1.Op.in]: ["pending", "in-progress"] },
                },
            });
        }
        catch {
            // Tasks table may not exist
        }
        // Total assistants under this doctor
        const totalAssistants = await Appuser_1.AppUser.count({
            where: {
                role: "ASSISTANT",
                parentId: doctorId,
            },
        });
        // Patients needing follow-up
        let patientsNeedingFollowUp = 0;
        try {
            patientsNeedingFollowUp = await Patient_1.Patient.count({
                where: {
                    doctorId,
                    testCompletionPercentage: { [sequelize_1.Op.lt]: 100 },
                    totalTestsPrescribed: { [sequelize_1.Op.gt]: 0 },
                },
            });
        }
        catch {
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
    async getAssistantDashboard(assistantId) {
        // Get assistant info
        const assistant = await Appuser_1.AppUser.findByPk(assistantId);
        if (!assistant || assistant.role !== "ASSISTANT") {
            throw new Error("Assistant not found");
        }
        const doctorId = assistant.parentId;
        if (!doctorId) {
            throw new Error("Assistant is not assigned to a doctor");
        }
        // Total patients under the doctor
        const totalPatients = await Patient_1.Patient.count({
            where: { doctorId },
        });
        // Active cases
        const activeCases = await Patient_1.Patient.count({
            where: {
                doctorId,
                "$diary.status$": "active",
            },
            include: [
                {
                    model: Diary_1.Diary,
                    as: "diary",
                    required: true,
                },
            ],
        });
        // Tasks assigned to this assistant
        const totalTasks = await Task_1.Task.count({
            where: { assignedTo: assistantId },
        });
        // Pending tasks
        const pendingTasks = await Task_1.Task.count({
            where: {
                assignedTo: assistantId,
                status: "pending",
            },
        });
        // In-progress tasks
        const inProgressTasks = await Task_1.Task.count({
            where: {
                assignedTo: assistantId,
                status: "in-progress",
            },
        });
        // Completed tasks
        const completedTasks = await Task_1.Task.count({
            where: {
                assignedTo: assistantId,
                status: "completed",
            },
        });
        // Overdue tasks
        const overdueTasks = await Task_1.Task.count({
            where: {
                assignedTo: assistantId,
                status: { [sequelize_1.Op.in]: ["pending", "in-progress"] },
                dueDate: { [sequelize_1.Op.lt]: new Date() },
            },
        });
        // Recent tasks
        const recentTasks = await Task_1.Task.findAll({
            where: { assignedTo: assistantId },
            order: [["createdAt", "DESC"]],
            limit: 10,
        });
        // Patients needing follow-up calls
        const patientsNeedingCalls = await Patient_1.Patient.count({
            where: {
                doctorId,
                lastDoctorContact: {
                    [sequelize_1.Op.or]: [
                        { [sequelize_1.Op.is]: null },
                        { [sequelize_1.Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // 7 days ago
                    ],
                },
            },
        });
        // Fetch parent doctor name for the assistant banner
        let doctorName = '';
        if (doctorId) {
            const doctor = await Appuser_1.AppUser.findByPk(doctorId, {
                attributes: ['id', 'fullName'],
            });
            doctorName = doctor?.fullName ? `Dr. ${doctor.fullName}` : '';
        }
        return {
            doctorName,
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
            assistantStatus: assistant.assistantStatus || "ACTIVE",
            patientAccessMode: assistant.patientAccessMode || "all",
            assignedPatientIds: assistant.assignedPatientIds || [],
        };
    }
    async getAllSuperAdmins() {
        const getSuperAdmins = await Appuser_1.AppUser.findAll({
            where: { role: "SUPER_ADMIN" },
            attributes: ["id", "fullName", "email", "phone", "createdAt"],
        });
        return getSuperAdmins;
    }
}
exports.dashboardService = new DashboardService();
