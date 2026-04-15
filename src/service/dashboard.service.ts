import { AppUser } from "../models/Appuser";
import { Patient } from "../models/Patient";
import { VendorProfile } from "../models/VendorProfile";
import { GeneratedDiary } from "../models/GeneratedDiary";
import { Diary } from "../models/Diary";
import { Transaction } from "../models/Transaction";
import { ScanLog } from "../models/ScanLog";
import { BubbleScanResult } from "../models/BubbleScanResult";
import { Task } from "../models/Task";
import { Op } from "sequelize";
import { DIARY_STATUS } from "../utils/diaryStatus";

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
      where: { status: DIARY_STATUS.APPROVED },
    });

    // Pending diary approvals
    const pendingApprovals = await Diary.count({
      where: { status: DIARY_STATUS.PENDING },
    });

    // Total patients
    const totalPatients = await Patient.count();

    // Total revenue (sum of all diary sales)
    const revenueData = await Diary.sum("saleAmount", {
      where: { status: DIARY_STATUS.APPROVED },
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
        status: DIARY_STATUS.APPROVED,
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
    // const vendor = await VendorProfile.findOne({
    //   where: { vendorId: vendorId },
    // });

    // if (!vendor) {
    //   throw new Error("Vendor profile not found");
    // }

    // Total sales (all diaries sold by this vendor)
    const totalSales = await Diary.count({
      where: { vendorId },
    });

    // Approved sales
    const approvedSales = await Diary.count({
      where: {
        vendorId,
        status: DIARY_STATUS.APPROVED,
      },
    });

    // Pending sales (awaiting approval)
    const pendingSales = await Diary.count({
      where: {
        vendorId,
        status: DIARY_STATUS.PENDING,
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
  async getDoctorDashboard(doctorId: string) {
    try {
      // ─────────────────────────────────────────────────────────────
      // Doctor Info
      // ─────────────────────────────────────────────────────────────
      const doctor = await AppUser.findByPk(doctorId, {
        attributes: ["id", "fullName", "email"],
      });

      // ─────────────────────────────────────────────────────────────
      // Patient Counts
      // "ongoing"  = ACTIVE + CRITICAL (actively monitored)
      // "dormant"  = ON_HOLD
      // "closed"   = INACTIVE + COMPLETED
      // "reassigned" = DOCTOR_REASSIGNED
      // ─────────────────────────────────────────────────────────────
      const totalPatients = await Patient.count({ where: { doctorId } });

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
          Patient.count({
            where: { doctorId, status: { [Op.in]: ["ACTIVE", "CRITICAL"] } },
          }),
          Patient.count({ where: { doctorId, status: "ON_HOLD" } }),
          Patient.count({
            where: { doctorId, status: { [Op.in]: ["INACTIVE", "COMPLETED"] } },
          }),
          Patient.count({ where: { doctorId, status: "DOCTOR_REASSIGNED" } }),
        ]);
      } catch (err) {
        console.error("Patient status query failed:", err);
      }

      // ─────────────────────────────────────────────────────────────
      // Get Patient IDs
      // ─────────────────────────────────────────────────────────────
      const doctorPatients = await Patient.findAll({
        where: { doctorId },
        attributes: ["id"],
        raw: true,
      });

      const doctorPatientIds = doctorPatients.map((p: { id: string }) => p.id);

      // ─────────────────────────────────────────────────────────────
      // Diary Stats
      // BubbleScanResult is the primary table (processed entries).
      // ScanLog is the fallback for patients with no BubbleScanResult data.
      // Never combine both — they track the same logical scans.
      // pendingReviews only counts BubbleScanResult entries that are
      // fully processed (processingStatus = 'completed') and unreviewed.
      // ─────────────────────────────────────────────────────────────
      let totalEntries = 0;
      let pendingReviews = 0;
      let flaggedEntries = 0;
      let weekEntries = 0;
      let scanTypeCount = { scan: 0, manual: 0 };
      let recentEntries: unknown[] = [];

      if (doctorPatientIds.length > 0) {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const patientWhere = { patientId: { [Op.in]: doctorPatientIds } };

        try {
          const [bsTotal, bsPending, bsFlagged, bsWeek, bsScanType] =
            await Promise.all([
              BubbleScanResult.count({ where: patientWhere }),
              // Only entries that are fully processed AND not yet reviewed
              BubbleScanResult.count({
                where: {
                  ...patientWhere,
                  processingStatus: "completed",
                  doctorReviewed: false,
                },
              }),
              BubbleScanResult.count({
                where: { ...patientWhere, flagged: true },
              }),
              BubbleScanResult.count({
                where: { ...patientWhere, scannedAt: { [Op.gte]: oneWeekAgo } },
              }),
              BubbleScanResult.count({
                where: { ...patientWhere, submissionType: "scan" },
              }),
            ]);

          if (bsTotal > 0) {
            // BubbleScanResult has data — use it exclusively
            totalEntries = bsTotal;
            pendingReviews = bsPending;
            flaggedEntries = bsFlagged;
            weekEntries = bsWeek;
            scanTypeCount = {
              scan: bsScanType,
              manual: bsTotal - bsScanType,
            };
          } else {
            // Fallback to ScanLog (legacy data)
            const [slTotal, slPending, slFlagged, slWeek] = await Promise.all([
              ScanLog.count({ where: patientWhere }),
              ScanLog.count({
                where: { ...patientWhere, doctorReviewed: false },
              }),
              ScanLog.count({ where: { ...patientWhere, flagged: true } }),
              ScanLog.count({
                where: { ...patientWhere, scannedAt: { [Op.gte]: oneWeekAgo } },
              }),
            ]);
            totalEntries = slTotal;
            pendingReviews = slPending;
            flaggedEntries = slFlagged;
            weekEntries = slWeek;
            scanTypeCount = { scan: 0, manual: slTotal };
          }
        } catch (err) {
          console.error("Diary stats query failed:", err);
        }

        // ─────────────────────────────────────────────────────────────
        // Recent Entries
        // ─────────────────────────────────────────────────────────────
        try {
          recentEntries = await BubbleScanResult.findAll({
            where: patientWhere,
            order: [["scannedAt", "DESC"]],
            limit: 10,
            attributes: [
              "id", "patientId", "pageNumber", "submissionType",
              "processingStatus", "doctorReviewed", "flagged",
              "scannedAt", "createdAt",
            ],
            include: [
              {
                model: Patient,
                as: "patient",
                attributes: ["id", "fullName", "phone"],
              },
            ],
          });
        } catch (err) {
          console.error("Recent BubbleScanResult failed:", err);
        }

        if (recentEntries.length === 0) {
          try {
            recentEntries = await ScanLog.findAll({
              where: patientWhere,
              order: [["scannedAt", "DESC"]],
              limit: 10,
              include: [
                {
                  model: Patient,
                  as: "patient",
                  attributes: ["id", "fullName", "phone"],
                },
              ],
            });
          } catch (err) {
            console.error("Recent ScanLog failed:", err);
          }
        }
      }

      // ─────────────────────────────────────────────────────────────
      // Team
      // ─────────────────────────────────────────────────────────────
      const totalAssistants = await AppUser.count({
        where: { role: "ASSISTANT", parentId: doctorId },
      });

      // ─────────────────────────────────────────────────────────────
      // Follow-up Patients
      // ─────────────────────────────────────────────────────────────
      let patientsNeedingFollowUp = 0;

      try {
        patientsNeedingFollowUp = await Patient.count({
          where: {
            doctorId,
            testCompletionPercentage: { [Op.lt]: 100 },
            totalTestsPrescribed: { [Op.gt]: 0 },
          },
        });
      } catch (err) {
        console.error("Follow-up query failed:", err);
      }

      return {
        doctorName: doctor?.fullName || null,
        patients: {
          total: totalPatients,
          ongoing: ongoingPatients,
          dormant: dormantPatients,
          closedCases: closedPatients,
          doctorReassigned: doctorReassignedPatients,
          activeCases: ongoingPatients,
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
        team: {
          totalAssistants,
        },
        recentEntries,
      };
    } catch (error) {
      console.error("Dashboard API failed:", error);
      throw error;
    }
  }
  /**
   * Assistant Dashboard Statistics
   */
  async getAssistantDashboard(assistantId: string) {
    const assistant = await AppUser.findByPk(assistantId);

    if (!assistant || assistant.role !== "ASSISTANT") {
      throw new Error("Assistant not found");
    }

    const doctorId = assistant.parentId;
    if (!doctorId) {
      throw new Error("Assistant is not assigned to a doctor");
    }

    // ─────────────────────────────────────────────────────────────
    // Resolve the patient scope for this assistant:
    //   "all"      → all patients of the parent doctor
    //   "selected" → only the explicitly assigned patient IDs
    // ─────────────────────────────────────────────────────────────
    const accessMode = assistant.patientAccessMode || "all";
    const assignedIds: string[] = assistant.assignedPatientIds || [];

    const patientScope =
      accessMode === "selected" && assignedIds.length > 0
        ? { id: { [Op.in]: assignedIds } }
        : { doctorId };

    // ─────────────────────────────────────────────────────────────
    // Patient Counts (scoped to assistant's accessible patients)
    // "ongoing"  = ACTIVE + CRITICAL
    // "dormant"  = ON_HOLD
    // "closed"   = INACTIVE + COMPLETED
    // ─────────────────────────────────────────────────────────────
    const totalPatients = await Patient.count({ where: patientScope });

    let ongoingPatients = 0;
    let dormantPatients = 0;
    let closedPatients = 0;

    try {
      [ongoingPatients, dormantPatients, closedPatients] = await Promise.all([
        Patient.count({
          where: { ...patientScope, status: { [Op.in]: ["ACTIVE", "CRITICAL"] } },
        }),
        Patient.count({ where: { ...patientScope, status: "ON_HOLD" } }),
        Patient.count({
          where: { ...patientScope, status: { [Op.in]: ["INACTIVE", "COMPLETED"] } },
        }),
      ]);
    } catch (err) {
      console.error("Assistant patient status query failed:", err);
    }

    // ─────────────────────────────────────────────────────────────
    // Get scoped Patient IDs for diary queries
    // ─────────────────────────────────────────────────────────────
    const scopedPatients = await Patient.findAll({
      where: patientScope,
      attributes: ["id"],
      raw: true,
    });
    const scopedPatientIds = scopedPatients.map((p: { id: string }) => p.id);

    // ─────────────────────────────────────────────────────────────
    // Diary Stats — same fallback logic as doctor dashboard:
    // use BubbleScanResult exclusively; fall back to ScanLog only
    // when no BubbleScanResult entries exist.
    // pendingReviews = processingStatus:'completed' + doctorReviewed:false
    // ─────────────────────────────────────────────────────────────
    let totalEntries = 0;
    let pendingReviews = 0;
    let flaggedEntries = 0;
    let weekEntries = 0;
    let scanTypeCount = { scan: 0, manual: 0 };

    if (scopedPatientIds.length > 0) {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const patientWhere = { patientId: { [Op.in]: scopedPatientIds } };

      try {
        const [bsTotal, bsPending, bsFlagged, bsWeek, bsScanType] =
          await Promise.all([
            BubbleScanResult.count({ where: patientWhere }),
            BubbleScanResult.count({
              where: {
                ...patientWhere,
                processingStatus: "completed",
                doctorReviewed: false,
              },
            }),
            BubbleScanResult.count({
              where: { ...patientWhere, flagged: true },
            }),
            BubbleScanResult.count({
              where: { ...patientWhere, scannedAt: { [Op.gte]: oneWeekAgo } },
            }),
            BubbleScanResult.count({
              where: { ...patientWhere, submissionType: "scan" },
            }),
          ]);

        if (bsTotal > 0) {
          totalEntries = bsTotal;
          pendingReviews = bsPending;
          flaggedEntries = bsFlagged;
          weekEntries = bsWeek;
          scanTypeCount = { scan: bsScanType, manual: bsTotal - bsScanType };
        } else {
          const [slTotal, slPending, slFlagged, slWeek] = await Promise.all([
            ScanLog.count({ where: patientWhere }),
            ScanLog.count({
              where: { ...patientWhere, doctorReviewed: false },
            }),
            ScanLog.count({ where: { ...patientWhere, flagged: true } }),
            ScanLog.count({
              where: { ...patientWhere, scannedAt: { [Op.gte]: oneWeekAgo } },
            }),
          ]);
          totalEntries = slTotal;
          pendingReviews = slPending;
          flaggedEntries = slFlagged;
          weekEntries = slWeek;
          scanTypeCount = { scan: 0, manual: slTotal };
        }
      } catch (err) {
        console.error("Assistant diary stats query failed:", err);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // Tasks assigned to this assistant
    // ─────────────────────────────────────────────────────────────
    let totalTasks = 0;
    let pendingTasks = 0;
    let inProgressTasks = 0;
    let completedTasks = 0;
    let overdueTasks = 0;
    let recentTasks: unknown[] = [];
    try {
      [totalTasks, pendingTasks, inProgressTasks, completedTasks, overdueTasks] =
        await Promise.all([
          Task.count({ where: { assignedTo: assistantId } }),
          Task.count({ where: { assignedTo: assistantId, status: "pending" } }),
          Task.count({ where: { assignedTo: assistantId, status: "in-progress" } }),
          Task.count({ where: { assignedTo: assistantId, status: "completed" } }),
          Task.count({
            where: {
              assignedTo: assistantId,
              status: { [Op.in]: ["pending", "in-progress"] },
              dueDate: { [Op.lt]: new Date() },
            },
          }),
        ]);
      recentTasks = await Task.findAll({
        where: { assignedTo: assistantId },
        order: [["createdAt", "DESC"]],
        limit: 10,
      });
    } catch (err) {
      console.error("Assistant task query failed:", err);
    }

    // ─────────────────────────────────────────────────────────────
    // Parent doctor name (for the assistant dashboard banner)
    // ─────────────────────────────────────────────────────────────
    const doctorRecord = await AppUser.findByPk(doctorId, {
      attributes: ["id", "fullName"],
    });
    const doctorName = doctorRecord?.fullName
      ? `Dr. ${doctorRecord.fullName}`
      : "";

    return {
      doctorName,
      patients: {
        total: totalPatients,
        ongoing: ongoingPatients,
        dormant: dormantPatients,
        closedCases: closedPatients,
        activeCases: ongoingPatients,
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
      patientAccessMode: accessMode,
      assignedPatientIds: assignedIds,
    };
  }

  async getAllSuperAdmins() {
    const getSuperAdmins = await AppUser.findAll({
      where: { role: "SUPER_ADMIN" },
      attributes: ["id", "fullName", "email", "phone", "isActive", "createdAt"],
    });
    return getSuperAdmins;
  }
}

export const dashboardService = new DashboardService();
