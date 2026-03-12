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
    ],
    // Logging configuration
    logging: true,
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
