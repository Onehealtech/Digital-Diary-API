import { Sequelize } from 'sequelize-typescript';
import dotenv from 'dotenv';
import { AppUser } from '../models/Appuser';
import { Patient } from '../models/Patient';
import { ScanLog } from '../models/ScanLog';
import { Reminder } from '../models/Reminder';
import { Order } from '../models/Order';
import { SplitConfig } from '../models/SplitConfig';
import { SplitTransaction } from '../models/SplitTransaction';
import { WebhookLog } from '../models/WebhookLog';



// Note: Patient, Organ, and CancerGroup use regular Sequelize (not sequelize-typescript)
// and are initialized in their own model files via Model.init()

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
  models: [AppUser, Patient, ScanLog, Reminder, Order, SplitConfig, SplitTransaction, WebhookLog],

  // Logging configuration
  logging: console.log, // Log all SQL queries (disable in production)

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

    await sequelize.sync({ alter: false }); // Add new columns to existing tables
    console.log('✅ Database models synchronized');

  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};

// Export as default for compatibility with existing code
export default sequelize;