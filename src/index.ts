import dotenv from 'dotenv';
dotenv.config();
console.log('DB HOST:', process.env.DATABASE_HOST);

import 'reflect-metadata';
import express, { Application, Request, Response, NextFunction } from 'express';

import path from 'path';
import cors from 'cors';
import routes from './routes';

import bodyParser from "body-parser";
import { initializeDatabase } from './config/Dbconnetion';
import { fcmService } from './service/fcm.service';
import { reminderCronService } from './service/reminderCron.service';

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Allowed origins for CORS
// const allowedOrigins = ['http://localhost:4000', 'http://localhost:3000' , 'http://localhost:3500','http://localhost:5500'];

/**
 * Middleware Configuration
 */
// Enable CORS for cross-origin requests
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);



// Capture raw body for webhook signature verification, then parse JSON
app.use(express.json({
  verify: (req: any, _res, buf) => {
    // Store raw body for webhook routes that need signature verification
    req.rawBody = buf.toString();
  },
}));

// Parse URL-encoded request bodies
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

/**
 * Health Check Endpoint
 */
app.get('/', (req: Request, res: Response) => {
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

app.use('/api', routes);



/**
 * 404 Handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: false,
    message: 'Route not found',
    path: req.path,
  });
});
/**
 * Global Error Handler
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
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

    await initializeDatabase();

    // Initialize Firebase Admin SDK for push notifications
    fcmService.initialize();

    // Start background jobs/cron intervals
    reminderCronService.start();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`📝 API Base URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the application
startServer();

// Export app for testing
export default app;
