"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// ─── Environment Loading ────────────────────────────────────────────────
// NODE_ENV is set by PM2 (ecosystem.config.js) or the deploy script.
// Mapping: "production" → .env.production, anything else → .env.staging
const NODE_ENV = process.env.NODE_ENV || "staging";
const envFile = NODE_ENV === "production" ? ".env.production" : ".env.staging";
const envPath = path_1.default.resolve(__dirname, "..", envFile);
const result = dotenv_1.default.config({ path: envPath });
if (result.error) {
    console.error(`[ENV] Failed to load ${envFile}:`, result.error.message);
    process.exit(1);
}
console.log(`[ENV] Environment: ${NODE_ENV}`);
console.log(`[ENV] Loaded: ${envFile}`);
console.log(`[ENV] Port: ${process.env.PORT}`);
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
const Dbconnetion_1 = require("./config/Dbconnetion");
const fcm_service_1 = require("./service/fcm.service");
const reminderCron_service_1 = require("./service/reminderCron.service");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Allowed origins for CORS
// const allowedOrigins = ['http://localhost:4000', 'http://localhost:3000' , 'http://localhost:3500','http://localhost:5500'];
/**
 * Middleware Configuration
 */
// Enable CORS for cross-origin requests
app.use((0, cors_1.default)({
    origin: '*',
    credentials: true,
}));
// Capture raw body for webhook signature verification, then parse JSON
app.use(express_1.default.json({
    verify: (req, _res, buf) => {
        // Store raw body for webhook routes that need signature verification
        req.rawBody = buf.toString();
    },
}));
// Parse URL-encoded request bodies
app.use(express_1.default.urlencoded({ extended: true }));
// Serve static files for uploads
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
/**
 * Health Check Endpoint
 */
app.get('/', (req, res) => {
    res.json({
        status: true,
        message: 'Digital Diary API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});
/**
 * API Routes
 */
app.use('/api', routes_1.default);
/**
 * 404 Handler
 */
app.use((req, res) => {
    res.status(404).json({
        status: false,
        message: 'Route not found',
        path: req.path,
    });
});
/**
 * Global Error Handler
 */
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({
        status: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});
/**
 * Start Server
 */
const startServer = async () => {
    try {
        await (0, Dbconnetion_1.initializeDatabase)();
        // Initialize Firebase Admin SDK for push notifications
        fcm_service_1.fcmService.initialize();
        // Start background jobs/cron intervals
        reminderCron_service_1.reminderCronService.start();
        // Start Express server
        app.listen(PORT, () => {
            console.log(`🚀 Server is running on http://localhost:${PORT}`);
            console.log(`📝 API Base URL: http://localhost:${PORT}/api`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
// Start the application
startServer();
// Export app for testing
exports.default = app;
