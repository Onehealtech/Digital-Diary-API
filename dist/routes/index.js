"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
const admin_routes_1 = __importDefault(require("./admin.routes"));
const doctor_routes_1 = __importDefault(require("./doctor.routes"));
const clinic_routes_1 = __importDefault(require("./clinic.routes"));
const dashboard_routes_1 = __importDefault(require("./dashboard.routes"));
const scan_routes_1 = __importDefault(require("./scan.routes"));
const patient_routes_1 = __importDefault(require("./patient.routes"));
const vendor_routes_1 = __importDefault(require("./vendor.routes"));
const diary_routes_1 = __importDefault(require("./diary.routes"));
const task_routes_1 = __importDefault(require("./task.routes"));
const notification_routes_1 = __importDefault(require("./notification.routes"));
const diary_entry_routes_1 = __importDefault(require("./diary-entry.routes"));
const financial_routes_1 = __importDefault(require("./financial.routes"));
const export_routes_1 = __importDefault(require("./export.routes"));
const doctor_management_routes_1 = __importDefault(require("./doctor-management.routes"));
const assistant_management_routes_1 = __importDefault(require("./assistant-management.routes"));
const user_management_routes_1 = __importDefault(require("./user-management.routes"));
const audit_routes_1 = __importDefault(require("./audit.routes"));
const uploadImage_route_1 = __importDefault(require("./uploadImage.route"));
const order_routes_1 = __importDefault(require("./order.routes"));
const wallet_routes_1 = __importDefault(require("./wallet.routes"));
const bubbleScan_routes_1 = __importDefault(require("./bubbleScan.routes"));
const visionScan_routes_1 = __importDefault(require("../modules/visionScan/visionScan.routes"));
const diaryPage_routes_1 = __importDefault(require("./diaryPage.routes"));
const doctorOnboard_routes_1 = __importDefault(require("./doctorOnboard.routes"));
const welcome_routes_1 = __importDefault(require("./welcome.routes"));
const diary_sales_routes_1 = __importDefault(require("./diary-sales.routes"));
const subscription_routes_1 = __importDefault(require("./subscription.routes"));
const doctorRequest_routes_1 = __importDefault(require("./doctorRequest.routes"));
const accountDeletion_routes_1 = __importDefault(require("./accountDeletion.routes"));
const paymentConfig_routes_1 = __importDefault(require("./paymentConfig.routes"));
const webhook_controller_1 = require("../controllers/webhook.controller");
const router = express_1.default.Router();
// API v1 Routes
router.use("/v1", auth_routes_1.default); // Auth routes (staff & patient login)
router.use("/v1/admin", admin_routes_1.default); // Super Admin routes
router.use("/v1/doctor", doctor_routes_1.default); // Doctor routes
router.use("/v1/clinic", clinic_routes_1.default); // Clinic routes (patient registration)
router.use("/v1/dashboard", dashboard_routes_1.default); // Dashboard routes
router.use("/v1/scan", scan_routes_1.default); // Scan routes (patient symptom logging)
router.use("/v1/patient", patient_routes_1.default); // Patient routes (profile, reminders)
router.use("/v1/vendors", vendor_routes_1.default); // Vendor routes (sales, inventory, wallet)
router.use("/v1", diary_routes_1.default); // Diary routes (inventory, generation, approval)
router.use("/v1/tasks", task_routes_1.default); // Task routes (Doctor → Assistant task management)
router.use("/v1/notifications", notification_routes_1.default); // Notification routes (Doctor/Assistant → Patient)
router.use("/v1/diary-entries", diary_entry_routes_1.default); // Diary entry routes (Doctor/Assistant review system)
router.use("/v1/financials", financial_routes_1.default); // Financial routes (Transactions, Payouts, Statements)
router.use("/v1/reports", export_routes_1.default); // Reports & Export routes (Patient data, Diary pages, Analytics)
router.use("/v1/doctors", doctor_management_routes_1.default); // Doctor management routes (Super Admin)
router.use("/v1/assistants", assistant_management_routes_1.default); // Assistant management routes (Super Admin & Doctor)
router.use("/v1/users", user_management_routes_1.default); // User management routes (Super Admin archive/restore)
router.use("/v1/audit-logs", audit_routes_1.default); // Audit log routes (Super Admin only)
router.use("/v1/upload", uploadImage_route_1.default); // Upload image routes (Super Admin only)
router.use("/v1/order", order_routes_1.default); // Order routes (Super Admin only)
router.use("/v1/wallets", wallet_routes_1.default); // Wallet routes (Super Admin only)
router.use("/v1/bubble-scan", bubbleScan_routes_1.default); // Bubble scan OMR routes (Patient upload, Doctor review)
router.use("/v1/vision-scan", visionScan_routes_1.default); // Vision AI scan routes (Patient upload, Doctor review)
router.use("/v1/diary-pages", diaryPage_routes_1.default); // Diary page routes (questions for manual entry, seed)
router.use("/v1/doctor-onboard", doctorOnboard_routes_1.default); // Doctor onboard requests & vendor-doctor assignments
router.use("/welcome", welcome_routes_1.default); // Welcome route (first 21 visits show message)
router.use("/v1/diary-sales", diary_sales_routes_1.default); // Diary selling (all roles) & diary requests
router.use("/v1/subscriptions", subscription_routes_1.default); // Subscription plans & patient subscriptions
router.use("/v1/doctor-requests", doctorRequest_routes_1.default); // Patient→Doctor assignment requests (self-signup)
router.use("/v1/account", accountDeletion_routes_1.default); // Account deletion (Play Store compliance)
router.use("/v1/payment-config", paymentConfig_routes_1.default); // Payment gateway config (Super Admin)
// Webhook routes (no auth — verified via signatures)
router.post("/v1/webhooks/cashfree", webhook_controller_1.handleCashfreeWebhook);
router.post("/v1/webhooks/razorpay", webhook_controller_1.handleRazorpayWebhook);
exports.default = router;
