import dotenv from "dotenv";

dotenv.config();

const BASE_URL = "https://cpaas.messagecentral.com";
const customerId = process.env.MSG_CENTRAL_CUSTOMER_ID;
const authToken = process.env.MSG_CENTRAL_AUTH_TOKEN;
const senderId = process.env.MSG_CENTRAL_SENDER_ID || "ONEHEL";

// In-memory store for verificationId (keyed by diaryId)
const verificationStore = new Map<string, { verificationId: string; expiresAt: Date }>();

class MessageCentralService {
  private isConfigured = false;

  constructor() {
    if (customerId && authToken) {
      this.isConfigured = true;
      console.log("✅ Message Central Service initialized.");
    } else {
      console.warn("⚠️ Message Central credentials missing in .env. SMS/OTP will not be sent.");
    }
  }

  /**
   * Extract just the 10-digit mobile number (strip country code, +, spaces).
   * "8469838559" → "8469838559"
   * "+918469838559" → "8469838559"
   * "918469838559" → "8469838559"
   */
  private extractMobileNumber(phone: string): string {
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length > 10 && digits.startsWith("91")) {
      return digits.slice(2);
    }
    return digits;
  }

  /**
   * Send OTP to a mobile number via Message Central.
   * Message Central generates the OTP — we just get back a verificationId.
   * @param mobileNumber Phone number (any format — will be normalized)
   * @param key Unique key to store verificationId (e.g., diaryId)
   * @returns true if OTP sent successfully
   */
  async sendOTP(mobileNumber: string, key: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn(`[Mock OTP Log] To: ${mobileNumber} | Key: ${key}`);
      return false;
    }

    const mobile = this.extractMobileNumber(mobileNumber);

    try {
      const url = `${BASE_URL}/verification/v3/send?countryCode=91&customerId=${customerId}&flowType=SMS&mobileNumber=${mobile}&otpLength=6`;
      const response = await fetch(url, {
        method: "POST",
        headers: { authToken: authToken! },
      });

      const data = await response.json();

      if (response.ok && data?.data?.verificationId) {
        const verificationId = data.data.verificationId;

        // Store verificationId with 5-minute expiry
        const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || "5");
        verificationStore.set(key.toLowerCase(), {
          verificationId,
          expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
        });

        // Auto-cleanup
        setTimeout(() => {
          verificationStore.delete(key.toLowerCase());
        }, expiryMinutes * 60 * 1000);

        console.log(`✅ OTP sent to ${mobile} via Message Central, verificationId: ${verificationId}`);
        return true;
      } else {
        console.error(`❌ Message Central send OTP failed:`, data);
        return false;
      }
    } catch (error) {
      console.error(`❌ Failed to send OTP to ${mobile}:`, error);
      return false;
    }
  }

  /**
   * Verify OTP via Message Central.
   * @param mobileNumber Phone number
   * @param key Unique key used during sendOTP (e.g., diaryId)
   * @param code The OTP code entered by user
   * @returns true if OTP is valid
   */
  async verifyOTP(mobileNumber: string, key: string, code: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn(`[Mock OTP Verify] Key: ${key} | Code: ${code}`);
      return false;
    }

    const stored = verificationStore.get(key.toLowerCase());
    if (!stored) {
      console.warn(`No verificationId found for key: ${key}`);
      return false;
    }

    if (new Date() > stored.expiresAt) {
      verificationStore.delete(key.toLowerCase());
      return false;
    }

    const mobile = this.extractMobileNumber(mobileNumber);

    try {
      const url = `${BASE_URL}/verification/v3/validateOtp?countryCode=91&mobileNumber=${mobile}&verificationId=${stored.verificationId}&customerId=${customerId}&code=${code}`;
      const response = await fetch(url, {
        method: "GET",
        headers: { authToken: authToken! },
      });

      const data = await response.json();

      if (response.ok && data?.data?.verificationStatus === "VERIFICATION_COMPLETED") {
        verificationStore.delete(key.toLowerCase());
        console.log(`✅ OTP verified for ${mobile}`);
        return true;
      } else {
        console.warn(`❌ OTP verification failed for ${mobile}:`, data);
        return false;
      }
    } catch (error) {
      console.error(`❌ OTP verification error for ${mobile}:`, error);
      return false;
    }
  }

  /**
   * Send a transactional SMS (for notifications, appointments, etc.).
   * Uses Message Central's SMS API.
   * @param to Phone number
   * @param message SMS content
   * @returns true if sent successfully
   */
  async sendSMS(to: string, message: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn(`[Mock SMS Log] To: ${to} | Message: ${message}`);
      return false;
    }

    const mobile = this.extractMobileNumber(to);
    const encodedMessage = encodeURIComponent(message);

    try {
      const url = `${BASE_URL}/verification/v3/send?countryCode=91&customerId=${customerId}&flowType=SMS&mobileNumber=${mobile}&senderId=${senderId}&type=SMS&message=${encodedMessage}&messageType=TRANSACTION`;
      const response = await fetch(url, {
        method: "POST",
        headers: { authToken: authToken! },
      });

      const data = await response.json();

      if (response.ok && data?.responseCode === 200) {
        console.log(`✅ SMS sent to ${mobile} via Message Central`);
        return true;
      } else {
        console.error(`❌ Message Central SMS failed for ${mobile}:`, data);
        return false;
      }
    } catch (error) {
      console.error(`❌ Failed to send SMS to ${mobile}:`, error);
      return false;
    }
  }
}

export const messageCentralService = new MessageCentralService();
