"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.twilioService = void 0;
const twilio_1 = __importDefault(require("twilio"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
class TwilioService {
    constructor() {
        this.client = null;
        this.isConfigured = false;
        this.init();
    }
    init() {
        if (accountSid && authToken && twilioPhoneNumber) {
            try {
                this.client = (0, twilio_1.default)(accountSid, authToken);
                this.isConfigured = true;
                console.log("✅ Twilio Service initialized.");
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
     * Send an SMS to a phone number.
     * @param to Phone number to send SMS to (must include country code, e.g., +91...)
     * @param message Text message content
     */
    async sendSMS(to, message) {
        if (!this.isConfigured || !this.client) {
            console.warn(`[Mock SMS Log] To: ${to} | Message: ${message}`);
            return false; // Silently fail or return false if Twilio is not configured
        }
        try {
            const response = await this.client.messages.create({
                body: message,
                from: twilioPhoneNumber,
                to: to,
            });
            console.log(`✅ SMS sent to ${to}, SID: ${response.sid}`);
            return true;
        }
        catch (error) {
            console.error(`❌ Failed to send SMS to ${to}:`, error);
            return false; // Depending on requirements, could throw Error
        }
    }
}
exports.twilioService = new TwilioService();
