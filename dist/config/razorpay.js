"use strict";
// src/config/razorpay.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRazorpayInstance = exports.RAZORPAY_WEBHOOK_SECRET = exports.RAZORPAY_KEY_SECRET = exports.RAZORPAY_KEY_ID = void 0;
const razorpay_1 = __importDefault(require("razorpay"));
exports.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
exports.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
exports.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";
/** Lazy-initialized Razorpay instance — avoids crash at startup when keys are missing. */
let _instance = null;
function getRazorpayInstance() {
    if (!_instance) {
        if (!exports.RAZORPAY_KEY_ID) {
            throw new Error("RAZORPAY_KEY_ID is not set in environment variables");
        }
        _instance = new razorpay_1.default({
            key_id: exports.RAZORPAY_KEY_ID,
            key_secret: exports.RAZORPAY_KEY_SECRET,
        });
    }
    return _instance;
}
exports.getRazorpayInstance = getRazorpayInstance;
