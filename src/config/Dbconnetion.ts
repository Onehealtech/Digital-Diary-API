import { Sequelize } from 'sequelize-typescript';
import dotenv from 'dotenv';
import { AppUser } from '../models/Appuser';
import { Patient } from '../models/Patient';
import { ScanLog } from '../models/ScanLog';
import { Reminder } from '../models/Reminder';
import { VendorProfile } from '../models/VendorProfile';
import { GeneratedDiary } from '../models/GeneratedDiary';
import { Diary } from '../models/Diary';
import { DiaryRequest } from '../models/DiaryRequest';
import { Task } from '../models/Task';
import { Notification } from '../models/Notification';
import { Transaction } from '../models/Transaction';
import { AuditLog } from '../models/AuditLog';
import { Export } from '../models/Export';
import { Order } from '../models/Order';
import { SplitConfig } from '../models/SplitConfig';
import { SplitTransaction } from '../models/SplitTransaction';
import { WebhookLog } from '../models/WebhookLog';
import ImageHistory from '../models/ImageHistory.model';
import { Wallet } from '../models/Wallet';
import { Payout } from '../models/payout.model';
import { WalletTransaction } from '../models/walletTransaction.model';
import { BubbleScanResult } from '../models/BubbleScanResult';
import { DiaryPage } from '../models/DiaryPage';
import { DoctorOnboardRequest } from '../models/DoctorOnboardRequest';
import { VendorDoctor } from '../models/VendorDoctor';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import { UserSubscription } from '../models/UserSubscription';
import { DoctorAssignmentRequest } from '../models/DoctorAssignmentRequest';
import { PatientDoctorSuggestion } from '../models/PatientDoctorSuggestion';
import { PaymentConfig } from '../models/PaymentConfig';
import { DoctorPatientHistory } from '../models/DoctorPatientHistory';

// Load environment variables from .env file
dotenv.config();

/**
 * Sequelize Database Connection Configuration
 * Connects to PostgreSQL database hosted on GCP Cloud SQL
 */
export const sequelize = new Sequelize({
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
    AppUser,
    Patient,
    ScanLog,
    Reminder,
    VendorProfile,
    GeneratedDiary,
    Diary,
    DiaryRequest,
    Task,
    Notification,
    Transaction,
    AuditLog,
    Export,
    Order,
    SplitConfig,
    SplitTransaction,
    WebhookLog,
    ImageHistory,
    Wallet,
    Payout,
    WalletTransaction,
    BubbleScanResult,
    DiaryPage,
    DoctorOnboardRequest,
    VendorDoctor,
    SubscriptionPlan,
    UserSubscription,
    DoctorAssignmentRequest,
    PatientDoctorSuggestion,
    PaymentConfig,
    DoctorPatientHistory,
  ],

  // Logging configuration
   logging: false, // Disable SQL query logging for production

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
export const initializeDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');

    // await sequelize.sync({ alter: true }); // Add new columns to existing tables

    // ── Targeted migrations (idempotent) ──────────────────────────────────
    // Add patient deactivation columns and INACTIVE status
    await sequelize.query(`
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
    `).catch((err: unknown) => {
      console.warn('⚠️ Patient deactivation migration warning:', err instanceof Error ? err.message : err);
    });

    // Add 'cancelled' to diary_requests status enum
    await sequelize.query(`
      DO $$
      BEGIN
        ALTER TYPE "enum_diary_requests_status" ADD VALUE IF NOT EXISTS 'cancelled';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END
      $$;
    `).catch((err: unknown) => {
      console.warn('⚠️ DiaryRequest cancelled enum migration warning:', err instanceof Error ? err.message : err);
    });

    // Add bankDetails JSONB column to app-users
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app-users' AND column_name = 'bankDetails') THEN
          ALTER TABLE "app-users" ADD COLUMN "bankDetails" JSONB;
        END IF;
      END
      $$;
    `).catch((err: unknown) => {
      console.warn('⚠️ bankDetails migration warning:', err instanceof Error ? err.message : err);
    });

    // Ensure app-users table has all model-defined columns
    await sequelize.query(`
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
    `).catch((err: unknown) => {
      console.warn('⚠️ app-users column migration warning:', err instanceof Error ? err.message : err);
    });

    // Ensure diaries table has seller tracking columns
    await sequelize.query(`
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
    `).catch((err: unknown) => {
      console.warn('⚠️ diaries seller tracking migration warning:', err instanceof Error ? err.message : err);
    });

    // Create subscription_plans table if not exists
    await sequelize.query(`
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
    `).catch((err: unknown) => {
      console.warn('⚠️ subscription_plans migration warning:', err instanceof Error ? err.message : err);
    });

    // Create user_subscriptions table if not exists
    await sequelize.query(`
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
    `).catch((err: unknown) => {
      console.warn('⚠️ user_subscriptions migration warning:', err instanceof Error ? err.message : err);
    });

    // Make patients.doctorId nullable + add registrationSource for self-signup
    await sequelize.query(`
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
    `).catch((err: unknown) => {
      console.warn('⚠️ Patient self-signup migration warning:', err instanceof Error ? err.message : err);
    });

    // Create payment_config table and seed default row
    await sequelize.query(`
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
    `).catch((err: unknown) => {
      console.warn('⚠️ payment_config migration warning:', err instanceof Error ? err.message : err);
    });

    // Add new columns to orders table for dual gateway + subscription support
    await sequelize.query(`
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
    `).catch((err: unknown) => {
      console.warn('⚠️ orders dual gateway migration warning:', err instanceof Error ? err.message : err);
    });

    // Create patient_doctor_suggestions table
    await sequelize.query(`
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
    `).catch((err: unknown) => {
      console.warn('⚠️ patient_doctor_suggestions migration warning:', err instanceof Error ? err.message : err);
    });

    // Create doctor_patient_history table for tracking assignment periods
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "doctor_patient_history" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId" UUID NOT NULL REFERENCES "patients"("id"),
        "doctorId" UUID NOT NULL REFERENCES "app-users"("id"),
        "assignedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "unassignedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `).catch((err: unknown) => {
      console.warn('⚠️ doctor_patient_history migration warning:', err instanceof Error ? err.message : err);
    });

    // Create doctor_assignment_requests table
    await sequelize.query(`
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
    `).catch((err: unknown) => {
      console.warn('⚠️ doctor_assignment_requests migration warning:', err instanceof Error ? err.message : err);
    });

    // Add CANCELLED to doctor_assignment_requests status enum
    await sequelize.query(`
      ALTER TYPE "enum_doctor_assignment_requests_status" ADD VALUE IF NOT EXISTS 'CANCELLED';
    `).catch((err: unknown) => {
      console.warn('⚠️ doctor_assignment_requests status enum migration warning:', err instanceof Error ? err.message : err);
    });

    // ── Self-registration approval migrations ─────────────────────────────

    // Add selfRegistered flag to app-users (true = pending super admin approval)
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app-users' AND column_name = 'selfRegistered') THEN
          ALTER TABLE "app-users" ADD COLUMN "selfRegistered" BOOLEAN NOT NULL DEFAULT false;
        END IF;
      END
      $$;
    `).catch((err: unknown) => {
      console.warn('⚠️ selfRegistered column migration warning:', err instanceof Error ? err.message : err);
    });

    // ── Referral system migrations ─────────────────────────────────────────

    // Add referralCode to app-users (unique, generated per user)
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'app-users' AND column_name = 'referralCode') THEN
          ALTER TABLE "app-users" ADD COLUMN "referralCode" VARCHAR(20) UNIQUE;
        END IF;
      END
      $$;
    `).catch((err: unknown) => {
      console.warn('⚠️ referralCode column migration warning:', err instanceof Error ? err.message : err);
    });

    // Backfill referralCode for existing users that don't have one
    await sequelize.query(`
      UPDATE "app-users"
      SET "referralCode" = upper(substring(md5(random()::text || id::text) from 1 for 8))
      WHERE "referralCode" IS NULL;
    `).catch((err: unknown) => {
      console.warn('⚠️ referralCode backfill migration warning:', err instanceof Error ? err.message : err);
    });

    // Add referredByCode to doctor_onboard_requests
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'doctor_onboard_requests' AND column_name = 'referredByCode') THEN
          ALTER TABLE "doctor_onboard_requests" ADD COLUMN "referredByCode" VARCHAR(20);
        END IF;
      END
      $$;
    `).catch((err: unknown) => {
      console.warn('⚠️ referredByCode column migration warning:', err instanceof Error ? err.message : err);
    });

    // Add coinBalance to wallets
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'coinBalance') THEN
          ALTER TABLE "wallets" ADD COLUMN "coinBalance" INTEGER NOT NULL DEFAULT 0;
        END IF;
      END
      $$;
    `).catch((err: unknown) => {
      console.warn('⚠️ coinBalance column migration warning:', err instanceof Error ? err.message : err);
    });

    // Add REFERRAL_BONUS to wallet_transactions category enum
    await sequelize.query(`
      ALTER TYPE "enum_wallet_transactions_category" ADD VALUE IF NOT EXISTS 'REFERRAL_BONUS';
    `).catch((err: unknown) => {
      console.warn('⚠️ REFERRAL_BONUS enum migration warning:', err instanceof Error ? err.message : err);
    });

    console.log('✅ Database models synchronized');

  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

// Export as default for compatibility with existing code
export default sequelize;