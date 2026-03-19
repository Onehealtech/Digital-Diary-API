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
import userManagementRoutes from "./user-management.routes";
import auditRoutes from "./audit.routes";
import uploadImageRoutes from "./uploadImage.route";
import orderRoutes from "./order.routes";
import walletRoutes from "./wallet.routes";
import bubbleScanRoutes from "./bubbleScan.routes";
import visionScanRoutes from "../modules/visionScan/visionScan.routes";
import diaryPageRoutes from "./diaryPage.routes";
import doctorOnboardRoutes from "./doctorOnboard.routes";
import welcomeRoutes from "./welcome.routes";
import diarySalesRoutes from "./diary-sales.routes";
import subscriptionRoutes from "./subscription.routes";
import doctorRequestRoutes from "./doctorRequest.routes";
import accountDeletionRoutes from "./accountDeletion.routes";

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
router.use("/v1/users", userManagementRoutes); // User management routes (Super Admin archive/restore)
router.use("/v1/audit-logs", auditRoutes); // Audit log routes (Super Admin only)
router.use("/v1/upload", uploadImageRoutes); // Upload image routes (Super Admin only)
router.use("/v1/order", orderRoutes); // Order routes (Super Admin only)
router.use("/v1/wallets", walletRoutes); // Wallet routes (Super Admin only)
router.use("/v1/bubble-scan", bubbleScanRoutes); // Bubble scan OMR routes (Patient upload, Doctor review)
router.use("/v1/vision-scan", visionScanRoutes); // Vision AI scan routes (Patient upload, Doctor review)
router.use("/v1/diary-pages", diaryPageRoutes); // Diary page routes (questions for manual entry, seed)
router.use("/v1/doctor-onboard", doctorOnboardRoutes); // Doctor onboard requests & vendor-doctor assignments
router.use("/welcome", welcomeRoutes); // Welcome route (first 21 visits show message)
router.use("/v1/diary-sales", diarySalesRoutes); // Diary selling (all roles) & diary requests
router.use("/v1/subscriptions", subscriptionRoutes); // Subscription plans & patient subscriptions
router.use("/v1/doctor-requests", doctorRequestRoutes); // Patient→Doctor assignment requests (self-signup)
router.use("/v1/account", accountDeletionRoutes); // Account deletion (Play Store compliance)

export default router;
