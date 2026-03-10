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
});
exports.redisConnection.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
});
exports.redisConnection.on("connect", () => {
    console.log("[Redis] Connected successfully");
});
