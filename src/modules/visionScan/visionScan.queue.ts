import { Queue, Worker, Job } from "bullmq";
import { redisConnection } from "../../config/redis";
import { visionScanService } from "./visionScan.service";

const QUEUE_NAME = "vision-scan-extraction";

export interface VisionScanJobData {
    scanRecordId: string;
    base64: string;
    mimeType: string;
    diaryType: string;
    detectedPageNumber: number;
    patientId: string;
}

export const visionScanQueue = new Queue<VisionScanJobData>(QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
    },
});

export const visionScanWorker = new Worker<VisionScanJobData>(
    QUEUE_NAME,
    async (job: Job<VisionScanJobData>) => {
        console.log(`[VisionScan Worker] Processing job ${job.id} for scan ${job.data.scanRecordId}`);
        const result = await visionScanService.processExtraction(job.data);
        console.log(`[VisionScan Worker] Extraction result for ${job.data.scanRecordId}:`, JSON.stringify(result, null, 2));
    },
    {
        connection: redisConnection,
        concurrency: 3,
    }
);

visionScanWorker.on("completed", (job) => {
    console.log(`[VisionScan Worker] Job ${job.id} completed for scan ${job.data.scanRecordId}`);
});

visionScanWorker.on("failed", (job, err) => {
    console.error(`[VisionScan Worker] Job ${job?.id} failed:`, err.message);
});
