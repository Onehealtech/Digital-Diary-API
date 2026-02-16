import express from "express";
import authRoutes from "./auth.routes";
import adminRoutes from "./admin.routes";
import doctorRoutes from "./doctor.routes";
import clinicRoutes from "./clinic.routes";
import dashboardRoutes from "./dashboard.routes";
import scanRoutes from "./scan.routes";
import patientRoutes from "./patient.routes";
import vendorRoutes from "./vendor.routes";
import diaryRoutes from "./diary.routes";
import taskRoutes from "./task.routes";
import notificationRoutes from "./notification.routes";
import diaryEntryRoutes from "./diary-entry.routes";
import financialRoutes from "./financial.routes";
import exportRoutes from "./export.routes";
import doctorManagementRoutes from "./doctor-management.routes";
import assistantManagementRoutes from "./assistant-management.routes";
import auditRoutes from "./audit.routes";
import uploadImageRoutes from "./uploadImage.route";

const router = express.Router();

// API v1 Routes
router.use("/v1", authRoutes);           // Auth routes (staff & patient login)
router.use("/v1/admin", adminRoutes);     // Super Admin routes
router.use("/v1/doctor", doctorRoutes);   // Doctor routes
router.use("/v1/clinic", clinicRoutes);   // Clinic routes (patient registration)
router.use("/v1/dashboard", dashboardRoutes); // Dashboard routes
router.use("/v1/scan", scanRoutes);       // Scan routes (patient symptom logging)
router.use("/v1/patient", patientRoutes); // Patient routes (profile, reminders)
router.use("/v1/vendors", vendorRoutes);  // Vendor routes (sales, inventory, wallet)
router.use("/v1", diaryRoutes);          // Diary routes (inventory, generation, approval)
router.use("/v1/tasks", taskRoutes);     // Task routes (Doctor → Assistant task management)
router.use("/v1/notifications", notificationRoutes); // Notification routes (Doctor/Assistant → Patient)
router.use("/v1/diary-entries", diaryEntryRoutes); // Diary entry routes (Doctor/Assistant review system)
router.use("/v1/financials", financialRoutes); // Financial routes (Transactions, Payouts, Statements)
router.use("/v1/reports", exportRoutes); // Reports & Export routes (Patient data, Diary pages, Analytics)
router.use("/v1/doctors", doctorManagementRoutes); // Doctor management routes (Super Admin)
router.use("/v1/assistants", assistantManagementRoutes); // Assistant management routes (Super Admin & Doctor)
router.use("/v1/audit-logs", auditRoutes); // Audit log routes (Super Admin only)
router.use("/v1/upload", uploadImageRoutes); // Upload image routes (Super Admin only)

export default router;