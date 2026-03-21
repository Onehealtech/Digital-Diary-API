"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConnection = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
exports.redisConnection = new ioredis_1.default(REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
        if (times > 3) {
            console.warn("[Redis] Could not connect after 3 retries — giving up. Queue features will be unavailable.");
            return null; // stop retrying
        }
        return Math.min(times * 500, 3000);
    },
    lazyConnect: true,
});
exports.redisConnection.on("error", (err) => {
    if (err.code !== "ECONNREFUSED") {
        console.error("[Redis] Connection error:", err.message);
    }
});
exports.redisConnection.on("connect", () => {
    console.log("[Redis] Connected successfully");
});
// Attempt connection but don't block startup
exports.redisConnection.connect().catch(() => {
    console.warn("[Redis] Not available — app will run without queue features.");
});
