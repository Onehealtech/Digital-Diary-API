"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visionScanQueue = exports.VISION_SCAN_QUEUE_NAME = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../../config/redis");
exports.VISION_SCAN_QUEUE_NAME = "vision-scan-extraction";
exports.visionScanQueue = new bullmq_1.Queue(exports.VISION_SCAN_QUEUE_NAME, {
    connection: redis_1.redisConnection,
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
    },
});
