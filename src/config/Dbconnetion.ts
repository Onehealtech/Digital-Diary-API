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
  ],

  // Logging configuration
   logging: true, // Disable SQL query logging for production

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

    console.log('✅ Database models synchronized');

  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

// Export as default for compatibility with existing code
export default sequelize;