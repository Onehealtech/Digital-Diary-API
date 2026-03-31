import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.FAST2SMS_API_KEY;
const FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2";

class Fast2SMSService {
  private isConfigured = false;

  constructor() {
    if (API_KEY) {
      this.isConfigured = true;
      console.log("✅ Fast2SMS Service initialized.");
    } else {
      console.warn("⚠️ FAST2SMS_API_KEY missing in .env. SMS will not be sent.");
    }
  }

  /**
   * Strip phone to 10-digit Indian mobile number.
   * Fast2SMS accepts numbers without country code.
   */
  private normalizePhone(phone: string): string {
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
    return digits.slice(-10);
  }

  async sendSMS(to: string, body: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn(`[Fast2SMS Mock] To: ${to} | Body: ${body}`);
      return false;
    }

    const number = this.normalizePhone(to);

    try {
      const response = await axios.post(
        FAST2SMS_URL,
        {
          message: body,
          language: "english",
          route: "q",
          numbers: number,
        },
        {
          headers: {
            authorization: API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data?.return === true) {
        console.log(`✅ SMS sent to ${number} via Fast2SMS`);
        return true;
      }

      console.error(`❌ Fast2SMS rejected:`, response.data);
      return false;
    } catch (error: any) {
      console.error(`❌ Fast2SMS error for ${number}:`, error.response?.data || error.message);
      return false;
    }
  }

  async sendOTP(to: string, otp: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn(`[Fast2SMS Mock OTP] To: ${to} | OTP: ${otp}`);
      return false;
    }

    const number = this.normalizePhone(to);

    try {
      const response = await axios.post(
        FAST2SMS_URL,
        {
          variables_values: otp,
          route: "otp",
          numbers: number,
        },
        {
          headers: {
            authorization: API_KEY,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data?.return === true) {
        console.log(`✅ OTP sent to ${number} via Fast2SMS`);
        return true;
      }

      console.error(`❌ Fast2SMS OTP rejected:`, response.data);
      return false;
    } catch (error: any) {
      console.error(`❌ Fast2SMS OTP error for ${number}:`, error.response?.data || error.message);
      return false;
    }
  }

  isReady(): boolean {
    return this.isConfigured;
  }
}

export const twilioService = new Fast2SMSService();
