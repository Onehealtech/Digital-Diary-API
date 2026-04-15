"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
require("reflect-metadata");
const bullmq_1 = require("bullmq");
const redis_1 = require("./config/redis");
const Dbconnetion_1 = require("./config/Dbconnetion");
const visionScan_service_1 = require("./modules/visionScan/visionScan.service");
const visionScan_queue_1 = require("./modules/visionScan/visionScan.queue");
const reminderCron_service_1 = require("./service/reminderCron.service");
async function start() {
    await (0, Dbconnetion_1.initializeDatabase)();
    // Start custom cron services
    reminderCron_service_1.reminderCronService.start();
    const worker = new bullmq_1.Worker(visionScan_queue_1.VISION_SCAN_QUEUE_NAME, async (job) => {
        console.log(`[Worker] Processing job ${job.id} for scan ${job.data.scanRecordId}`);
        await visionScan_service_1.visionScanService.processExtraction(job.data);
        console.log(`[Worker] Completed job ${job.id}`);
    }, {
        connection: redis_1.redisConnection,
        concurrency: 3,
    });
    worker.on("failed", (job, err) => {
        console.error(`[Worker] Job ${job?.id} failed:`, err.message);
    });
    worker.on("error", (err) => {
        console.error("[Worker] Error:", err);
    });
    console.log("[Worker] Vision scan worker started, waiting for jobs...");
}
start().catch((err) => {
    console.error("[Worker] Failed to start:", err);
    process.exit(1);
});
