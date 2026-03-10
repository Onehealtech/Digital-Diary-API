"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
console.log('DB HOST:', process.env.DATABASE_HOST);
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./routes"));
const Dbconnetion_1 = require("./config/Dbconnetion");
const fcm_service_1 = require("./service/fcm.service");
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
// Parse JSON request bodies
app.use(express_1.default.json());
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
