import { Queue } from "bullmq";
import { redisConnection } from "../../config/redis";

export const VISION_SCAN_QUEUE_NAME = "vision-scan-extraction";

export interface VisionScanJobData {
    scanRecordId: string;
    base64: string;
    mimeType: string;
    diaryType: string;
    detectedPageNumber: number;
    patientId: string;
}

export const visionScanQueue = new Queue<VisionScanJobData>(VISION_SCAN_QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
    },
});
