"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.twilioService = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
class TwilioService {
    constructor() {
        this.isConfigured = false;
        this.client = null;
        if (accountSid && authToken && fromNumber) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const twilio = require("twilio");
                this.client = twilio(accountSid, authToken);
                this.isConfigured = true;
                console.log("✅ Twilio SMS Service initialized.");
            }
            catch (error) {
                console.error("❌ Failed to initialize Twilio client:", error);
            }
        }
        else {
            console.warn("⚠️ Twilio credentials missing in .env. SMS will not be sent.");
        }
    }
    /**
     * Normalize phone number to E.164 format for India (+91XXXXXXXXXX).
     * Handles: "8469838559", "+918469838559", "918469838559"
     */
    formatPhoneNumber(phone) {
        const digits = phone.replace(/[^0-9]/g, "");
        if (digits.length === 10) {
            return `+91${digits}`;
        }
        if (digits.length > 10 && digits.startsWith("91")) {
            return `+${digits}`;
        }
        // Already has country code or unknown format — prefix with +
        return digits.startsWith("+") ? phone : `+${digits}`;
    }
    /**
     * Send an SMS message via Twilio.
     * @param to   Phone number (any format — will be normalized to E.164)
     * @param body SMS content
     * @returns true if sent successfully
     */
    async sendSMS(to, body) {
        if (!this.isConfigured || !this.client) {
            console.warn(`[Twilio Mock SMS] To: ${to} | Body: ${body}`);
            return false;
        }
        const formattedTo = this.formatPhoneNumber(to);
        try {
            const message = await this.client.messages.create({
                body,
                from: fromNumber,
                to: formattedTo,
            });
            console.log(`✅ SMS sent to ${formattedTo} via Twilio (SID: ${message.sid})`);
            return true;
        }
        catch (error) {
            console.error(`❌ Twilio SMS failed for ${formattedTo}:`, error.message || error);
            return false;
        }
    }
    /**
     * Send an OTP SMS via Twilio.
     * Uses our own OTP (generated in otpService) — NOT Twilio Verify.
     * This keeps OTP consistent across email and SMS channels.
     * @param to  Phone number
     * @param otp The 6-digit OTP code
     * @returns true if sent successfully
     */
    async sendOTP(to, otp) {
        const body = `Your OneHeal verification code is: ${otp}. It expires in ${process.env.OTP_EXPIRY_MINUTES || "5"} minutes. Do not share this code.`;
        return this.sendSMS(to, body);
    }
    /**
     * Check if Twilio is properly configured.
     */
    isReady() {
        return this.isConfigured;
    }
}
exports.twilioService = new TwilioService();
