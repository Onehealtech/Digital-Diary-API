"use strict";
// src/config/razorpay.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RAZORPAY_WEBHOOK_SECRET = exports.RAZORPAY_KEY_SECRET = exports.RAZORPAY_KEY_ID = exports.razorpayInstance = void 0;
const razorpay_1 = __importDefault(require("razorpay"));
exports.razorpayInstance = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});
exports.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
exports.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
exports.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";
