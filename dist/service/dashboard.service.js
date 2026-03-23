"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardService = void 0;
const Appuser_1 = require("../models/Appuser");
const Patient_1 = require("../models/Patient");
const GeneratedDiary_1 = require("../models/GeneratedDiary");
const Diary_1 = require("../models/Diary");
const ScanLog_1 = require("../models/ScanLog");
const BubbleScanResult_1 = require("../models/BubbleScanResult");
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
    // async getDoctorDashboard(doctorId: string) {
    //   // Get doctor info
    //   const doctor = await AppUser.findByPk(doctorId, {
    //     attributes: ["id", "fullName", "email"],
    //   });
    //   // ── Patient counts by status ──────────────────────────────────────
    //   const totalPatients = await Patient.count({ where: { doctorId } });
    //   let ongoingPatients = 0;
    //   let dormantPatients = 0;
    //   let closedPatients = 0;
    //   let doctorReassignedPatients = 0;
    //   try {
    //     [ongoingPatients, dormantPatients, closedPatients, doctorReassignedPatients ] = await Promise.all([
    //       Patient.count({ where: { doctorId, status: { [Op.notIn]: ["inactive", "on_hold"] } } }),
    //       Patient.count({ where: { doctorId, status: "ON_HOLD" } }),
    //       Patient.count({ where: { doctorId, status: "INACTIVE" } }),
    //       Patient.count({ where: { doctorId, status: "DOCTOR_REASSIGNED" } }),
    //     ]);
    //   } catch (err) {
    //     console.error("Patient status query failed:", err);
    //   }
    //   const activeCases = ongoingPatients;
    //   // ── Diary entry stats (combine BubbleScanResult + ScanLog) ────────
    //   const doctorPatientIds = (await Patient.findAll({
    //     where: { doctorId },
    //     attributes: ["id"],
    //     raw: true,
    //   })).map((p: { id: string }) => p.id);
    //   let totalEntries = 0;
    //   let pendingReviews = 0;
    //   let flaggedEntries = 0;
    //   let weekEntries = 0;
    //   let scanTypeCount = { scan: 0, manual: 0 };
    //   let recentEntries: unknown[] = [];
    //   if (doctorPatientIds.length > 0) {
    //     const oneWeekAgo = new Date();
    //     oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    //     const patientWhere = { patientId: { [Op.in]: doctorPatientIds } };
    //     // ── BubbleScanResult counts ──
    //     let bsTotal = 0, bsPending = 0, bsFlagged = 0, bsWeek = 0, bsScanType = 0;
    //     try {
    //       [bsPending, bsTotal, bsFlagged, bsWeek] = await Promise.all([
    //         BubbleScanResult.count({ where: { ...patientWhere, doctorReviewed: false } }),
    //         BubbleScanResult.count({ where: patientWhere }),
    //         BubbleScanResult.count({ where: { ...patientWhere, flagged: true } }),
    //         BubbleScanResult.count({ where: { ...patientWhere, scannedAt: { [Op.gte]: oneWeekAgo } } }),
    //       ]);
    //       bsScanType = await BubbleScanResult.count({
    //         where: { ...patientWhere, submissionType: "scan" },
    //       });
    //     } catch (err) {
    //       console.error("BubbleScanResult query failed:", err);
    //     }
    //     // ── ScanLog counts ──
    //     let slTotal = 0, slPending = 0, slFlagged = 0, slWeek = 0;
    //     try {
    //       [slPending, slTotal, slFlagged, slWeek] = await Promise.all([
    //         ScanLog.count({ where: { ...patientWhere, doctorReviewed: false } }),
    //         ScanLog.count({ where: patientWhere }),
    //         ScanLog.count({ where: { ...patientWhere, flagged: true } }),
    //         ScanLog.count({ where: { ...patientWhere, scannedAt: { [Op.gte]: oneWeekAgo } } }),
    //       ]);
    //     } catch (err) {
    //       console.error("ScanLog query failed:", err);
    //     }
    //     // ── Combine both sources ──
    //     totalEntries = bsTotal + slTotal;
    //     pendingReviews = bsPending + slPending;
    //     flaggedEntries = bsFlagged + slFlagged;
    //     weekEntries = bsWeek + slWeek;
    //     scanTypeCount = { scan: bsScanType, manual: (bsTotal - bsScanType) + slTotal };
    //     // Recent entries — prefer BubbleScanResult, fall back to ScanLog
    //     try {
    //       recentEntries = await BubbleScanResult.findAll({
    //         where: patientWhere,
    //         order: [["scannedAt", "DESC"]],
    //         limit: 10,
    //         attributes: ["id", "patientId", "pageNumber", "submissionType", "processingStatus", "doctorReviewed", "flagged", "scannedAt", "createdAt"],
    //         include: [{ model: Patient, as: "patient", attributes: ["id", "fullName", "phone"] }],
    //       });
    //     } catch (err) {
    //       console.error("BubbleScanResult recent entries failed:", err);
    //     }
    //     if ((recentEntries as unknown[]).length === 0) {
    //       try {
    //         recentEntries = await ScanLog.findAll({
    //           where: patientWhere,
    //           order: [["scannedAt", "DESC"]],
    //           limit: 10,
    //           include: [{ model: Patient, as: "patient", attributes: ["id", "fullName", "phone"] }],
    //         });
    //       } catch (err) {
    //         console.error("ScanLog recent entries failed:", err);
    //       }
    //     }
    //   }
    //   // Tasks
    //   let totalTasks = 0;
    //   let pendingTasks = 0;
    //   try {
    //     [totalTasks, pendingTasks] = await Promise.all([
    //       Task.count({ where: { createdBy: doctorId } }),
    //       Task.count({ where: { createdBy: doctorId, status: { [Op.in]: ["pending", "in-progress"] } } }),
    //     ]);
    //   } catch (err) {
    //     console.error("Task query failed:", err);
    //   }
    //   // Total assistants under this doctor
    //   const totalAssistants = await AppUser.count({
    //     where: { role: "ASSISTANT", parentId: doctorId },
    //   });
    //   // Patients needing follow-up
    //   let patientsNeedingFollowUp = 0;
    //   try {
    //     patientsNeedingFollowUp = await Patient.count({
    //       where: {
    //         doctorId,
    //         testCompletionPercentage: { [Op.lt]: 100 },
    //         totalTestsPrescribed: { [Op.gt]: 0 },
    //       },
    //     });
    //   } catch (err) {
    //     console.error("Follow-up query failed:", err);
    //   }
    //   const data = {
    //     doctorName: doctor?.fullName || null,
    //     patients: {
    //       total: totalPatients,
    //       ongoing: ongoingPatients,
    //       dormant: dormantPatients,
    //       closedCases: closedPatients,
    //       activeCases,
    //       needingFollowUp: patientsNeedingFollowUp,
    //     },
    //     diaryEntries: {
    //       total: totalEntries,
    //       thisWeek: weekEntries,
    //       pendingReviews,
    //       reviewed: totalEntries - pendingReviews,
    //       flagged: flaggedEntries,
    //       byType: scanTypeCount,
    //     },
    //     tasks: {
    //       total: totalTasks,
    //       pending: pendingTasks,
    //       completed: totalTasks - pendingTasks,
    //     },
    //     team: {
    //       totalAssistants,
    //     },
    //     recentEntries,
    //   };
    //   console.log(data);
    //   return {
    //     doctorName: doctor?.fullName || null,
    //     patients: {
    //       total: totalPatients,
    //       ongoing: ongoingPatients,
    //       dormant: dormantPatients,
    //       closedCases: closedPatients,
    //       activeCases,
    //       needingFollowUp: patientsNeedingFollowUp,
    //     },
    //     diaryEntries: {
    //       total: totalEntries,
    //       thisWeek: weekEntries,
    //       pendingReviews,
    //       reviewed: totalEntries - pendingReviews,
    //       flagged: flaggedEntries,
    //       byType: scanTypeCount,
    //     },
    //     tasks: {
    //       total: totalTasks,
    //       pending: pendingTasks,
    //       completed: totalTasks - pendingTasks,
    //     },
    //     team: {
    //       totalAssistants,
    //     },
    //     recentEntries,
    //   };
    // }
    async getDoctorDashboard(doctorId) {
        try {
            // ─────────────────────────────────────────────────────────────
            // Doctor Info
            // ─────────────────────────────────────────────────────────────
            const doctor = await Appuser_1.AppUser.findByPk(doctorId, {
                attributes: ["id", "fullName", "email"],
            });
            // Normalize statuses (IMPORTANT)
            const STATUS = {
                INACTIVE: "INACTIVE",
                ON_HOLD: "ON_HOLD",
                DOCTOR_REASSIGNED: "DOCTOR_REASSIGNED",
            };
            // ─────────────────────────────────────────────────────────────
            // Patient Counts
            // ─────────────────────────────────────────────────────────────
            const totalPatients = await Patient_1.Patient.count({ where: { doctorId } });
            let ongoingPatients = 0;
            let dormantPatients = 0;
            let closedPatients = 0;
            let doctorReassignedPatients = 0;
            try {
                [
                    ongoingPatients,
                    dormantPatients,
                    closedPatients,
                    doctorReassignedPatients,
                ] = await Promise.all([
                    Patient_1.Patient.count({
                        where: {
                            doctorId,
                            status: {
                                [sequelize_1.Op.notIn]: [
                                    STATUS.INACTIVE,
                                    STATUS.ON_HOLD,
                                    STATUS.DOCTOR_REASSIGNED,
                                ],
                            },
                        },
                    }),
                    Patient_1.Patient.count({ where: { doctorId, status: STATUS.ON_HOLD } }),
                    Patient_1.Patient.count({ where: { doctorId, status: STATUS.INACTIVE } }),
                    Patient_1.Patient.count({
                        where: { doctorId, status: STATUS.DOCTOR_REASSIGNED },
                    }),
                ]);
            }
            catch (err) {
                console.error("Patient status query failed:", err);
            }
            const activeCases = ongoingPatients;
            // ─────────────────────────────────────────────────────────────
            // Get Patient IDs
            // ─────────────────────────────────────────────────────────────
            const doctorPatients = await Patient_1.Patient.findAll({
                where: { doctorId },
                attributes: ["id"],
                raw: true,
            });
            const doctorPatientIds = doctorPatients.map((p) => p.id);
            // Debug (remove later)
            // ─────────────────────────────────────────────────────────────
            // Diary Stats
            // ─────────────────────────────────────────────────────────────
            let totalEntries = 0;
            let pendingReviews = 0;
            let flaggedEntries = 0;
            let weekEntries = 0;
            let scanTypeCount = { scan: 0, manual: 0 };
            let recentEntries = [];
            if (doctorPatientIds.length > 0) {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                const patientWhere = {
                    patientId: { [sequelize_1.Op.in]: doctorPatientIds },
                };
                try {
                    const [bsPending, bsTotal, bsFlagged, bsWeek, bsScanType, slPending, slTotal, slFlagged, slWeek,] = await Promise.all([
                        BubbleScanResult_1.BubbleScanResult.count({
                            where: { ...patientWhere, doctorReviewed: false },
                        }),
                        BubbleScanResult_1.BubbleScanResult.count({ where: patientWhere }),
                        BubbleScanResult_1.BubbleScanResult.count({
                            where: { ...patientWhere, flagged: true },
                        }),
                        BubbleScanResult_1.BubbleScanResult.count({
                            where: {
                                ...patientWhere,
                                scannedAt: { [sequelize_1.Op.gte]: oneWeekAgo },
                            },
                        }),
                        BubbleScanResult_1.BubbleScanResult.count({
                            where: { ...patientWhere, submissionType: "scan" },
                        }),
                        ScanLog_1.ScanLog.count({
                            where: { ...patientWhere, doctorReviewed: false },
                        }),
                        ScanLog_1.ScanLog.count({ where: patientWhere }),
                        ScanLog_1.ScanLog.count({
                            where: { ...patientWhere, flagged: true },
                        }),
                        ScanLog_1.ScanLog.count({
                            where: {
                                ...patientWhere,
                                scannedAt: { [sequelize_1.Op.gte]: oneWeekAgo },
                            },
                        }),
                    ]);
                    // Combine
                    totalEntries = bsTotal + slTotal;
                    pendingReviews = bsPending + slPending;
                    flaggedEntries = bsFlagged + slFlagged;
                    weekEntries = bsWeek + slWeek;
                    scanTypeCount = {
                        scan: bsScanType,
                        manual: bsTotal - bsScanType + slTotal,
                    };
                }
                catch (err) {
                    console.error("Diary stats query failed:", err);
                }
                // ─────────────────────────────────────────────────────────────
                // Recent Entries
                // ─────────────────────────────────────────────────────────────
                try {
                    recentEntries = await BubbleScanResult_1.BubbleScanResult.findAll({
                        where: patientWhere,
                        order: [["scannedAt", "DESC"]],
                        limit: 10,
                        attributes: [
                            "id",
                            "patientId",
                            "pageNumber",
                            "submissionType",
                            "processingStatus",
                            "doctorReviewed",
                            "flagged",
                            "scannedAt",
                            "createdAt",
                        ],
                        include: [
                            {
                                model: Patient_1.Patient,
                                as: "patient",
                                attributes: ["id", "fullName", "phone"],
                            },
                        ],
                    });
                }
                catch (err) {
                    console.error("Recent BubbleScanResult failed:", err);
                }
                if (recentEntries.length === 0) {
                    try {
                        recentEntries = await ScanLog_1.ScanLog.findAll({
                            where: patientWhere,
                            order: [["scannedAt", "DESC"]],
                            limit: 10,
                            include: [
                                {
                                    model: Patient_1.Patient,
                                    as: "patient",
                                    attributes: ["id", "fullName", "phone"],
                                },
                            ],
                        });
                    }
                    catch (err) {
                        console.error("Recent ScanLog failed:", err);
                    }
                }
            }
            // ─────────────────────────────────────────────────────────────
            // Tasks
            // ─────────────────────────────────────────────────────────────
            // let totalTasks = 0;
            // let pendingTasks = 0;
            // try {
            //   [totalTasks, pendingTasks] = await Promise.all([
            //     Task.count({ where: { createdBy: doctorId } }),
            //     Task.count({
            //       where: {
            //         createdBy: doctorId,
            //         status: { [Op.in]: ["pending", "in-progress"] },
            //       },
            //     }),
            //   ]);
            // } catch (err) {
            //   console.error("Task query failed:", err);
            // }
            // ─────────────────────────────────────────────────────────────
            // Team
            // ─────────────────────────────────────────────────────────────
            const totalAssistants = await Appuser_1.AppUser.count({
                where: { role: "ASSISTANT", parentId: doctorId },
            });
            // ─────────────────────────────────────────────────────────────
            // Follow-up Patients
            // ─────────────────────────────────────────────────────────────
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
            catch (err) {
                console.error("Follow-up query failed:", err);
            }
            // ─────────────────────────────────────────────────────────────
            // FINAL RESPONSE
            // ─────────────────────────────────────────────────────────────
            const response = {
                doctorName: doctor?.fullName || null,
                patients: {
                    total: totalPatients,
                    ongoing: ongoingPatients,
                    dormant: dormantPatients,
                    closedCases: closedPatients,
                    doctorReassigned: doctorReassignedPatients,
                    activeCases,
                    needingFollowUp: patientsNeedingFollowUp,
                },
                diaryEntries: {
                    total: totalEntries,
                    thisWeek: weekEntries,
                    pendingReviews,
                    reviewed: totalEntries - pendingReviews,
                    flagged: flaggedEntries,
                    byType: scanTypeCount,
                },
                // tasks: {
                //   total: totalTasks,
                //   pending: pendingTasks,
                //   completed: totalTasks - pendingTasks,
                // },
                team: {
                    totalAssistants,
                },
                recentEntries,
            };
            console.log("Dashboard Response:", response);
            return response;
        }
        catch (error) {
            console.error("Dashboard API failed:", error);
            throw error;
        }
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
        // ── Patient counts by status ──────────────────────────────────────
        const totalPatients = await Patient_1.Patient.count({ where: { doctorId } });
        let ongoingPatients = 0;
        let dormantPatients = 0;
        let closedPatients = 0;
        try {
            [ongoingPatients, dormantPatients, closedPatients] = await Promise.all([
                Patient_1.Patient.count({ where: { doctorId, status: { [sequelize_1.Op.notIn]: ["INACTIVE", "ON_HOLD"] } } }),
                Patient_1.Patient.count({ where: { doctorId, status: "ON_HOLD" } }),
                Patient_1.Patient.count({ where: { doctorId, status: "INACTIVE" } }),
            ]);
        }
        catch (err) {
            console.error("Assistant patient status query failed:", err);
        }
        const activeCases = ongoingPatients;
        // ── Diary entry stats (combine BubbleScanResult + ScanLog) ────────
        const doctorPatientIds = (await Patient_1.Patient.findAll({
            where: { doctorId },
            attributes: ["id"],
            raw: true,
        })).map((p) => p.id);
        let totalEntries = 0;
        let pendingReviews = 0;
        let flaggedEntries = 0;
        let weekEntries = 0;
        let scanTypeCount = { scan: 0, manual: 0 };
        if (doctorPatientIds.length > 0) {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const patientWhere = { patientId: { [sequelize_1.Op.in]: doctorPatientIds } };
            // ── BubbleScanResult counts ──
            let bsTotal = 0, bsPending = 0, bsFlagged = 0, bsWeek = 0, bsScanType = 0;
            try {
                [bsPending, bsTotal, bsFlagged, bsWeek] = await Promise.all([
                    BubbleScanResult_1.BubbleScanResult.count({ where: { ...patientWhere, doctorReviewed: false } }),
                    BubbleScanResult_1.BubbleScanResult.count({ where: patientWhere }),
                    BubbleScanResult_1.BubbleScanResult.count({ where: { ...patientWhere, flagged: true } }),
                    BubbleScanResult_1.BubbleScanResult.count({ where: { ...patientWhere, scannedAt: { [sequelize_1.Op.gte]: oneWeekAgo } } }),
                ]);
                bsScanType = await BubbleScanResult_1.BubbleScanResult.count({
                    where: { ...patientWhere, submissionType: "scan" },
                });
            }
            catch (err) {
                console.error("Assistant BubbleScanResult query failed:", err);
            }
            // ── ScanLog counts ──
            let slTotal = 0, slPending = 0, slFlagged = 0, slWeek = 0;
            try {
                [slPending, slTotal, slFlagged, slWeek] = await Promise.all([
                    ScanLog_1.ScanLog.count({ where: { ...patientWhere, doctorReviewed: false } }),
                    ScanLog_1.ScanLog.count({ where: patientWhere }),
                    ScanLog_1.ScanLog.count({ where: { ...patientWhere, flagged: true } }),
                    ScanLog_1.ScanLog.count({ where: { ...patientWhere, scannedAt: { [sequelize_1.Op.gte]: oneWeekAgo } } }),
                ]);
            }
            catch (err) {
                console.error("Assistant ScanLog query failed:", err);
            }
            // ── Combine both sources ──
            totalEntries = bsTotal + slTotal;
            pendingReviews = bsPending + slPending;
            flaggedEntries = bsFlagged + slFlagged;
            weekEntries = bsWeek + slWeek;
            scanTypeCount = { scan: bsScanType, manual: (bsTotal - bsScanType) + slTotal };
        }
        // Tasks assigned to this assistant
        let totalTasks = 0;
        let pendingTasks = 0;
        let inProgressTasks = 0;
        let completedTasks = 0;
        let overdueTasks = 0;
        let recentTasks = [];
        try {
            [totalTasks, pendingTasks, inProgressTasks, completedTasks, overdueTasks] = await Promise.all([
                Task_1.Task.count({ where: { assignedTo: assistantId } }),
                Task_1.Task.count({ where: { assignedTo: assistantId, status: "pending" } }),
                Task_1.Task.count({ where: { assignedTo: assistantId, status: "in-progress" } }),
                Task_1.Task.count({ where: { assignedTo: assistantId, status: "completed" } }),
                Task_1.Task.count({
                    where: {
                        assignedTo: assistantId,
                        status: { [sequelize_1.Op.in]: ["pending", "in-progress"] },
                        dueDate: { [sequelize_1.Op.lt]: new Date() },
                    },
                }),
            ]);
            recentTasks = await Task_1.Task.findAll({
                where: { assignedTo: assistantId },
                order: [["createdAt", "DESC"]],
                limit: 10,
            });
        }
        catch (err) {
            console.error("Assistant task query failed:", err);
        }
        // Patients needing follow-up calls
        let patientsNeedingCalls = 0;
        try {
            patientsNeedingCalls = await Patient_1.Patient.count({
                where: {
                    doctorId,
                    lastDoctorContact: {
                        [sequelize_1.Op.or]: [
                            { [sequelize_1.Op.is]: null },
                            { [sequelize_1.Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                        ],
                    },
                },
            });
        }
        catch (err) {
            console.error("Assistant follow-up query failed:", err);
        }
        // Fetch parent doctor name for the assistant banner
        let doctorName = '';
        if (doctorId) {
            const doctorRecord = await Appuser_1.AppUser.findByPk(doctorId, {
                attributes: ['id', 'fullName'],
            });
            doctorName = doctorRecord?.fullName ? `Dr. ${doctorRecord.fullName}` : '';
        }
        return {
            doctorName,
            patients: {
                total: totalPatients,
                ongoing: ongoingPatients,
                dormant: dormantPatients,
                closedCases: closedPatients,
                activeCases,
                needingCalls: patientsNeedingCalls,
            },
            diaryEntries: {
                total: totalEntries,
                thisWeek: weekEntries,
                pendingReviews,
                reviewed: totalEntries - pendingReviews,
                flagged: flaggedEntries,
                byType: scanTypeCount,
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
            attributes: ["id", "fullName", "email", "phone", "isActive", "createdAt"],
        });
        return getSuperAdmins;
    }
}
exports.dashboardService = new DashboardService();
