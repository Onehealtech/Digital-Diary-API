import dotenv from "dotenv";
dotenv.config();

import "reflect-metadata";
import { Worker, Job } from "bullmq";
import { redisConnection } from "./config/redis";
import { initializeDatabase } from "./config/Dbconnetion";
import { visionScanService } from "./modules/visionScan/visionScan.service";
import { VISION_SCAN_QUEUE_NAME, VisionScanJobData } from "./modules/visionScan/visionScan.queue";

async function start() {
    await initializeDatabase();

    const worker = new Worker<VisionScanJobData>(
        VISION_SCAN_QUEUE_NAME,
        async (job: Job<VisionScanJobData>) => {
            console.log(`[Worker] Processing job ${job.id} for scan ${job.data.scanRecordId}`);
            await visionScanService.processExtraction(job.data);
            console.log(`[Worker] Completed job ${job.id}`);
        },
        {
            connection: redisConnection,
            concurrency: 3,
        }
    );

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
