import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const redisConnection = new IORedis(REDIS_URL, {
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

redisConnection.on("error", (err: Error & { code?: string }) => {
    if (err.code !== "ECONNREFUSED") {
        console.error("[Redis] Connection error:", err.message);
    }
});

redisConnection.on("connect", () => {
    console.log("[Redis] Connected successfully");
});

// Attempt connection but don't block startup
redisConnection.connect().catch(() => {
    console.warn("[Redis] Not available — app will run without queue features.");
});
