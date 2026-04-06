"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = exports.sequelize = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const dotenv_1 = __importDefault(require("dotenv"));
const Appuser_1 = require("../models/Appuser");
const Patient_1 = require("../models/Patient");
const ScanLog_1 = require("../models/ScanLog");
const Reminder_1 = require("../models/Reminder");
const VendorProfile_1 = require("../models/VendorProfile");
const GeneratedDiary_1 = require("../models/GeneratedDiary");
const Diary_1 = require("../models/Diary");
const DiaryRequest_1 = require("../models/DiaryRequest");
const Task_1 = require("../models/Task");
const Notification_1 = require("../models/Notification");
const Transaction_1 = require("../models/Transaction");
const AuditLog_1 = require("../models/AuditLog");
const Export_1 = require("../models/Export");
const Order_1 = require("../models/Order");
const SplitConfig_1 = require("../models/SplitConfig");
const SplitTransaction_1 = require("../models/SplitTransaction");
const WebhookLog_1 = require("../models/WebhookLog");
const ImageHistory_model_1 = __importDefault(require("../models/ImageHistory.model"));
const Wallet_1 = require("../models/Wallet");
const payout_model_1 = require("../models/payout.model");
const walletTransaction_model_1 = require("../models/walletTransaction.model");
const BubbleScanResult_1 = require("../models/BubbleScanResult");
const DiaryPage_1 = require("../models/DiaryPage");
const DoctorOnboardRequest_1 = require("../models/DoctorOnboardRequest");
const VendorDoctor_1 = require("../models/VendorDoctor");
const SubscriptionPlan_1 = require("../models/SubscriptionPlan");
const UserSubscription_1 = require("../models/UserSubscription");
const DoctorAssignmentRequest_1 = require("../models/DoctorAssignmentRequest");
const PatientDoctorSuggestion_1 = require("../models/PatientDoctorSuggestion");
const PaymentConfig_1 = require("../models/PaymentConfig");
const DoctorPatientHistory_1 = require("../models/DoctorPatientHistory");
// Load environment variables from .env file
dotenv_1.default.config();
/**
 * Sequelize Database Connection Configuration
 * Connects to PostgreSQL database hosted on GCP Cloud SQL
 */
exports.sequelize = new sequelize_typescript_1.Sequelize({
    // Database connection details from environment variables
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'postgres',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    // Database type
    dialect: 'postgres',
    // SSL configuration for secure connection to GCP Cloud SQL
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false, // Allow self-signed certificates (development only)
        },
    },
    // Register sequelize-typescript models
    models: [
        Appuser_1.AppUser,
        Patient_1.Patient,
        ScanLog_1.ScanLog,
        Reminder_1.Reminder,
        VendorProfile_1.VendorProfile,
        GeneratedDiary_1.GeneratedDiary,
        Diary_1.Diary,
        DiaryRequest_1.DiaryRequest,
        Task_1.Task,
        Notification_1.Notification,
        Transaction_1.Transaction,
        AuditLog_1.AuditLog,
        Export_1.Export,
        Order_1.Order,
        SplitConfig_1.SplitConfig,
        SplitTransaction_1.SplitTransaction,
        WebhookLog_1.WebhookLog,
        ImageHistory_model_1.default,
        Wallet_1.Wallet,
        payout_model_1.Payout,
        walletTransaction_model_1.WalletTransaction,
        BubbleScanResult_1.BubbleScanResult,
        DiaryPage_1.DiaryPage,
        DoctorOnboardRequest_1.DoctorOnboardRequest,
        VendorDoctor_1.VendorDoctor,
        SubscriptionPlan_1.SubscriptionPlan,
        UserSubscription_1.UserSubscription,
        DoctorAssignmentRequest_1.DoctorAssignmentRequest,
        PatientDoctorSuggestion_1.PatientDoctorSuggestion,
        PaymentConfig_1.PaymentConfig,
        DoctorPatientHistory_1.DoctorPatientHistory,
    ],
    // Logging configuration
    logging: false,
    // Connection pool settings for better performance
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
});
/**
 * Initialize database connection and sync models
 * Creates tables if they don't exist
 * @returns Promise<void>
 */
const initializeDatabase = async () => {
    try {
        await exports.sequelize.authenticate();
        console.log('✅ Database connection established successfully');
        // await sequelize.sync({ alter: true }); // Add new columns to existing tables
        // ── Targeted migrations (idempotent) ──────────────────────────────────
        // Add patient deactivation columns and INACTIVE status
        await exports.sequelize.query(`
      DO $$
      BEGIN
        -- Add INACTIVE to status enum if not present
        BEGIN
          ALTER TYPE "enum_patients_status" ADD VALUE IF NOT EXISTS 'INACTIVE';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        BEGIN
          ALTER TYPE "enum_patients_status" ADD VALUE IF NOT EXISTS 'ON_HOLD';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        BEGIN
          ALTER TYPE "enum_patients_status" ADD VALUE IF NOT EXISTS 'DOCTOR_REASSIGNED';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END;

        -- Add deactivation columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'deactivationReason') THEN
          ALTER TABLE "patients" ADD COLUMN "deactivationReason" TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'deactivatedAt') THEN
          ALTER TABLE "patients" ADD COLUMN "deactivatedAt" TIMESTAMP WITH TIME ZONE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'deactivatedBy') THEN
          ALTER TABLE "patients" ADD COLUMN "deactivatedBy" UUID;
        END IF;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ Patient deactivation migration warning:', err instanceof Error ? err.message : err);
        });
        // Add 'cancelled' to diary_requests status enum
        await exports.sequelize.query(`
      DO $$
      BEGIN
        ALTER TYPE "enum_diary_requests_status" ADD VALUE IF NOT EXISTS 'cancelled';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ DiaryRequest cancelled enum migration warning:', err instanceof Error ? err.message : err);
        });
        // Add bankDetails JSONB column to app-users
        await exports.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app-users' AND column_name = 'bankDetails') THEN
          ALTER TABLE "app-users" ADD COLUMN "bankDetails" JSONB;
        END IF;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ bankDetails migration warning:', err instanceof Error ? err.message : err);
        });
        // Ensure app-users table has all model-defined columns
        await exports.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app-users' AND column_name = 'license') THEN
          ALTER TABLE "app-users" ADD COLUMN "license" VARCHAR(255);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app-users' AND column_name = 'hospital') THEN
          ALTER TABLE "app-users" ADD COLUMN "hospital" VARCHAR(255);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app-users' AND column_name = 'specialization') THEN
          ALTER TABLE "app-users" ADD COLUMN "specialization" VARCHAR(255);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app-users' AND column_name = 'landLinePhone') THEN
          ALTER TABLE "app-users" ADD COLUMN "landLinePhone" VARCHAR(50);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app-users' AND column_name = 'address') THEN
          ALTER TABLE "app-users" ADD COLUMN "address" VARCHAR(500);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app-users' AND column_name = 'city') THEN
          ALTER TABLE "app-users" ADD COLUMN "city" VARCHAR(100);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app-users' AND column_name = 'state') THEN
          ALTER TABLE "app-users" ADD COLUMN "state" VARCHAR(100);
        END IF;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ app-users column migration warning:', err instanceof Error ? err.message : err);
        });
        // Ensure diaries table has seller tracking columns
        await exports.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'diaries' AND column_name = 'soldBy') THEN
          ALTER TABLE "diaries" ADD COLUMN "soldBy" UUID;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'diaries' AND column_name = 'soldByRole') THEN
          ALTER TABLE "diaries" ADD COLUMN "soldByRole" VARCHAR(20);
        END IF;

        -- Make vendorId nullable (was NOT NULL for vendor-only sales)
        ALTER TABLE "diaries" ALTER COLUMN "vendorId" DROP NOT NULL;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ diaries seller tracking migration warning:', err instanceof Error ? err.message : err);
        });
        // Normalize diary approval statuses to a single source of truth:
        // PENDING (awaiting approval), APPROVED, and REJECTED.
        await exports.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'diaries' AND column_name = 'status') THEN
          -- Add new enum values for the approval workflow if the enum type exists.
          BEGIN
            ALTER TYPE "enum_diaries_status" ADD VALUE IF NOT EXISTS 'PENDING';
            ALTER TYPE "enum_diaries_status" ADD VALUE IF NOT EXISTS 'APPROVED';
            ALTER TYPE "enum_diaries_status" ADD VALUE IF NOT EXISTS 'REJECTED';
          EXCEPTION WHEN undefined_object THEN
            NULL;
          END;

          -- Map legacy statuses to canonical states.
          UPDATE "diaries"
          SET "status" = 'APPROVED'
          WHERE "status"::text = 'active';

          UPDATE "diaries"
          SET "status" = 'PENDING'
          WHERE "status"::text IN ('pending', 'inactive', 'completed');

          UPDATE "diaries"
          SET "status" = 'REJECTED'
          WHERE "status"::text IN ('rejected', 'available');

          ALTER TABLE "diaries" ALTER COLUMN "status" SET DEFAULT 'PENDING';
          ALTER TABLE "diaries" ALTER COLUMN "patientId" DROP NOT NULL;
          ALTER TABLE "diaries" ALTER COLUMN "doctorId" DROP NOT NULL;
        END IF;
      END
      $$;
    `).catch((err) => {
            console.warn('diary status normalization migration warning:', err instanceof Error ? err.message : err);
        });
        // Create subscription_plans table if not exists
        await exports.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "subscription_plans" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "monthlyPrice" DECIMAL(10,2) NOT NULL,
        "maxDiaryPages" INTEGER NOT NULL,
        "scanEnabled" BOOLEAN NOT NULL DEFAULT false,
        "manualEntryEnabled" BOOLEAN NOT NULL DEFAULT false,
        "isPopular" BOOLEAN NOT NULL DEFAULT false,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "deletedAt" TIMESTAMP WITH TIME ZONE
      );
    `).catch((err) => {
            console.warn('⚠️ subscription_plans migration warning:', err instanceof Error ? err.message : err);
        });
        // Create user_subscriptions table if not exists
        await exports.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "user_subscriptions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId" UUID NOT NULL REFERENCES "patients"("id"),
        "planId" UUID NOT NULL REFERENCES "subscription_plans"("id"),
        "diaryId" VARCHAR(255),
        "doctorId" UUID REFERENCES "app-users"("id"),
        "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        "paidAmount" DECIMAL(10,2) NOT NULL,
        "maxDiaryPages" INTEGER NOT NULL,
        "scanEnabled" BOOLEAN NOT NULL DEFAULT false,
        "manualEntryEnabled" BOOLEAN NOT NULL DEFAULT false,
        "pagesUsed" INTEGER NOT NULL DEFAULT 0,
        "paymentOrderId" VARCHAR(255),
        "paymentMethod" VARCHAR(255),
        "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "endDate" TIMESTAMP WITH TIME ZONE NOT NULL,
        "cancelledAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `).catch((err) => {
            console.warn('⚠️ user_subscriptions migration warning:', err instanceof Error ? err.message : err);
        });
        // Make patients.doctorId nullable + add registrationSource for self-signup
        await exports.sequelize.query(`
      DO $$
      BEGIN
        -- Make doctorId nullable (self-signup patients don't have one initially)
        ALTER TABLE "patients" ALTER COLUMN "doctorId" DROP NOT NULL;

        -- Make diaryId nullable (self-signup patients don't have a physical diary)
        ALTER TABLE "patients" ALTER COLUMN "diaryId" DROP NOT NULL;

        -- Add registrationSource column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'registrationSource') THEN
          ALTER TABLE "patients" ADD COLUMN "registrationSource" VARCHAR(20) NOT NULL DEFAULT 'VENDOR_ASSIGNED';
        END IF;

        -- Add onboardingViewCount column
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'onboardingViewCount') THEN
          ALTER TABLE "patients" ADD COLUMN "onboardingViewCount" INTEGER NOT NULL DEFAULT 0;
        END IF;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ Patient self-signup migration warning:', err instanceof Error ? err.message : err);
        });
        // Add tokenVersion columns for stateless JWT invalidation.
        // JWT cannot be revoked directly; tokenVersion rotation invalidates old tokens immediately.
        await exports.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app-users' AND column_name = 'tokenVersion') THEN
          ALTER TABLE "app-users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'tokenVersion') THEN
          ALTER TABLE "patients" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
        END IF;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ tokenVersion migration warning:', err instanceof Error ? err.message : err);
        });
        // Create payment_config table and seed default row
        await exports.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "payment_config" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "activeGateway" VARCHAR(20) NOT NULL DEFAULT 'CASHFREE',
        "updatedBy" UUID REFERENCES "app-users"("id"),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      INSERT INTO "payment_config" ("id", "activeGateway")
      SELECT gen_random_uuid(), 'CASHFREE'
      WHERE NOT EXISTS (SELECT 1 FROM "payment_config" LIMIT 1);
    `).catch((err) => {
            console.warn('⚠️ payment_config migration warning:', err instanceof Error ? err.message : err);
        });
        // Add new columns to orders table for dual gateway + subscription support
        await exports.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'paymentGateway') THEN
          ALTER TABLE "orders" ADD COLUMN "paymentGateway" VARCHAR(20);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'subscriptionPlanId') THEN
          ALTER TABLE "orders" ADD COLUMN "subscriptionPlanId" UUID REFERENCES "subscription_plans"("id");
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'transactionId') THEN
          ALTER TABLE "orders" ADD COLUMN "transactionId" VARCHAR(255);
        END IF;

        -- Make doctorId and vendorId nullable (subscription orders have no doctor/vendor)
        ALTER TABLE "orders" ALTER COLUMN "doctorId" DROP NOT NULL;
        ALTER TABLE "orders" ALTER COLUMN "vendorId" DROP NOT NULL;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ orders dual gateway migration warning:', err instanceof Error ? err.message : err);
        });
        // Create patient_doctor_suggestions table
        await exports.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "patient_doctor_suggestions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId" UUID NOT NULL REFERENCES "patients"("id"),
        "doctorName" VARCHAR(255) NOT NULL,
        "doctorPhone" VARCHAR(255),
        "doctorEmail" VARCHAR(255),
        "hospital" VARCHAR(255),
        "specialization" VARCHAR(255),
        "city" VARCHAR(255),
        "additionalNotes" TEXT,
        "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        "reviewedBy" UUID REFERENCES "app-users"("id"),
        "reviewedAt" TIMESTAMP WITH TIME ZONE,
        "rejectionReason" TEXT,
        "onboardedDoctorId" UUID,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `).catch((err) => {
            console.warn('⚠️ patient_doctor_suggestions migration warning:', err instanceof Error ? err.message : err);
        });
        // Create doctor_patient_history table for tracking assignment periods
        await exports.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "doctor_patient_history" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId" UUID NOT NULL REFERENCES "patients"("id"),
        "doctorId" UUID NOT NULL REFERENCES "app-users"("id"),
        "assignedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "unassignedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `).catch((err) => {
            console.warn('⚠️ doctor_patient_history migration warning:', err instanceof Error ? err.message : err);
        });
        // Create doctor_assignment_requests table
        await exports.sequelize.query(`
      CREATE TABLE IF NOT EXISTS "doctor_assignment_requests" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId" UUID NOT NULL REFERENCES "patients"("id"),
        "doctorId" UUID NOT NULL REFERENCES "app-users"("id"),
        "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        "rejectionReason" TEXT,
        "respondedAt" TIMESTAMP WITH TIME ZONE,
        "attemptNumber" INTEGER NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `).catch((err) => {
            console.warn('⚠️ doctor_assignment_requests migration warning:', err instanceof Error ? err.message : err);
        });
        // Add CANCELLED to doctor_assignment_requests status enum
        await exports.sequelize.query(`
      ALTER TYPE "enum_doctor_assignment_requests_status" ADD VALUE IF NOT EXISTS 'CANCELLED';
    `).catch((err) => {
            console.warn('⚠️ doctor_assignment_requests status enum migration warning:', err instanceof Error ? err.message : err);
        });
        // ── Self-registration approval migrations ─────────────────────────────
        // Add selfRegistered flag to app-users (true = pending super admin approval)
        await exports.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app-users' AND column_name = 'selfRegistered') THEN
          ALTER TABLE "app-users" ADD COLUMN "selfRegistered" BOOLEAN NOT NULL DEFAULT false;
        END IF;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ selfRegistered column migration warning:', err instanceof Error ? err.message : err);
        });
        // ── Referral system migrations ─────────────────────────────────────────
        // Add referralCode to app-users (unique, generated per user)
        await exports.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app-users' AND column_name = 'referralCode') THEN
          ALTER TABLE "app-users" ADD COLUMN "referralCode" VARCHAR(20) UNIQUE;
        END IF;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ referralCode column migration warning:', err instanceof Error ? err.message : err);
        });
        // Backfill referralCode for existing users that don't have one
        await exports.sequelize.query(`
      UPDATE "app-users"
      SET "referralCode" = upper(substring(md5(random()::text || id::text) from 1 for 8))
      WHERE "referralCode" IS NULL;
    `).catch((err) => {
            console.warn('⚠️ referralCode backfill migration warning:', err instanceof Error ? err.message : err);
        });
        // Add referredByCode to doctor_onboard_requests
        await exports.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'doctor_onboard_requests' AND column_name = 'referredByCode') THEN
          ALTER TABLE "doctor_onboard_requests" ADD COLUMN "referredByCode" VARCHAR(20);
        END IF;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ referredByCode column migration warning:', err instanceof Error ? err.message : err);
        });
        // Add coinBalance to wallets
        await exports.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'coinBalance') THEN
          ALTER TABLE "wallets" ADD COLUMN "coinBalance" INTEGER NOT NULL DEFAULT 0;
        END IF;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ coinBalance column migration warning:', err instanceof Error ? err.message : err);
        });
        // Add REFERRAL_BONUS to wallet_transactions category enum
        await exports.sequelize.query(`
      ALTER TYPE "enum_wallet_transactions_category" ADD VALUE IF NOT EXISTS 'REFERRAL_BONUS';
    `).catch((err) => {
            console.warn('⚠️ REFERRAL_BONUS enum migration warning:', err instanceof Error ? err.message : err);
        });
        // Add "doctor_manual" value to bubble_scan_results submissionType enum
        await exports.sequelize.query(`
      ALTER TYPE "enum_bubble_scan_results_submissionType" ADD VALUE IF NOT EXISTS 'doctor_manual';
    `).catch((err) => {
            console.warn('⚠️ bubble_scan_results submissionType enum migration warning:', err instanceof Error ? err.message : err);
        });
        // Add questionMarks column to bubble_scan_results for per-question doctor review
        await exports.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bubble_scan_results' AND column_name = 'questionMarks') THEN
          ALTER TABLE "bubble_scan_results" ADD COLUMN "questionMarks" JSONB;
        END IF;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ questionMarks column migration warning:', err instanceof Error ? err.message : err);
        });
        // Add attachmentUrl column to notifications table
        await exports.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'attachmentUrl') THEN
          ALTER TABLE "notifications" ADD COLUMN "attachmentUrl" TEXT;
        END IF;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ notifications.attachmentUrl column migration warning:', err instanceof Error ? err.message : err);
        });
        // Add attachmentUrl column to reminders table
        await exports.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reminders' AND column_name = 'attachmentUrl') THEN
          ALTER TABLE "reminders" ADD COLUMN "attachmentUrl" TEXT;
        END IF;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ reminders.attachmentUrl column migration warning:', err instanceof Error ? err.message : err);
        });
        // ── bubble_scan_results.reportUrls ────────────────────────────────────
        await exports.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'bubble_scan_results' AND column_name = 'reportUrls'
        ) THEN
          ALTER TABLE "bubble_scan_results" ADD COLUMN "reportUrls" JSONB NOT NULL DEFAULT '[]'::jsonb;
        END IF;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ bubble_scan_results.reportUrls migration warning:', err instanceof Error ? err.message : err);
        });
        // ── bubble_scan_results.questionReports ──────────────────────────────
        await exports.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'bubble_scan_results' AND column_name = 'questionReports'
        ) THEN
          ALTER TABLE "bubble_scan_results" ADD COLUMN "questionReports" JSONB NOT NULL DEFAULT '{}'::jsonb;
        END IF;
      END
      $$;
    `).catch((err) => {
            console.warn('⚠️ bubble_scan_results.questionReports migration warning:', err instanceof Error ? err.message : err);
        });
        console.log('✅ Database models synchronized');
    }
    catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
};
exports.initializeDatabase = initializeDatabase;
// Export as default for compatibility with existing code
exports.default = exports.sequelize;
