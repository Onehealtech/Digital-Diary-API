// src/config/razorpay.ts

import Razorpay from "razorpay";

export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
export const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

/** Lazy-initialized Razorpay instance — avoids crash at startup when keys are missing. */
let _instance: Razorpay | null = null;

export function getRazorpayInstance(): Razorpay {
  if (!_instance) {
    if (!RAZORPAY_KEY_ID) {
      throw new Error("RAZORPAY_KEY_ID is not set in environment variables");
    }
    _instance = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  }
  return _instance;
}
