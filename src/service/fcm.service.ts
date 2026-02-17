import * as admin from "firebase-admin";
import path from "path";
import fs from "fs";
import { Patient } from "../models/Patient";
import { AppUser } from "../models/Appuser";

class FCMService {
  private initialized = false;

  /**
   * Initialize Firebase Admin SDK
   * Reads service account from file path in FIREBASE_SERVICE_ACCOUNT_PATH env var
   */
  initialize() {
    if (this.initialized) return;

    const envPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const serviceAccountPath = envPath
      ? path.resolve(envPath)
      : path.join(__dirname, "../../firebase-service-account.json");

    if (!fs.existsSync(serviceAccountPath)) {
      console.warn(
        "⚠️ Firebase service account file not found at:",
        serviceAccountPath
      );
      console.warn(
        "⚠️ FCM push notifications will be disabled. Download the service account JSON from Firebase Console."
      );
      return;
    }

    try {
      const serviceAccount = JSON.parse(
        fs.readFileSync(serviceAccountPath, "utf8")
      );

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      this.initialized = true;
      console.log("✅ Firebase Admin SDK initialized for FCM");
    } catch (error) {
      console.error("❌ Failed to initialize Firebase Admin SDK:", error);
    }
  }

  /**
   * Send push notification to a single device
   */
  async sendPushNotification(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<boolean> {
    if (!this.initialized) {
      console.warn("⚠️ FCM not initialized, skipping push notification");
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        token: fcmToken,
        notification: { title, body },
        data: data || {},
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "default",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log("✅ FCM push sent:", response);
      return true;
    } catch (error: any) {
      console.error("❌ FCM push failed:", error.message);

      // If token is invalid/unregistered, remove it from DB
      if (
        error.code === "messaging/invalid-registration-token" ||
        error.code === "messaging/registration-token-not-registered"
      ) {
        await this.removeInvalidToken(fcmToken);
      }

      return false;
    }
  }

  /**
   * Send push notification to multiple devices
   */
  async sendMulticastPush(
    fcmTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.initialized) {
      console.warn("⚠️ FCM not initialized, skipping multicast push");
      return { successCount: 0, failureCount: 0 };
    }

    if (fcmTokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: fcmTokens,
        notification: { title, body },
        data: data || {},
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "default",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(
        `✅ FCM multicast: ${response.successCount} success, ${response.failureCount} failures`
      );

      // Remove invalid tokens
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (
          resp.error &&
          (resp.error.code === "messaging/invalid-registration-token" ||
            resp.error.code === "messaging/registration-token-not-registered")
        ) {
          invalidTokens.push(fcmTokens[idx]);
        }
      });

      if (invalidTokens.length > 0) {
        await this.removeInvalidTokens(invalidTokens);
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error: any) {
      console.error("❌ FCM multicast failed:", error.message);
      return { successCount: 0, failureCount: fcmTokens.length };
    }
  }

  /**
   * Remove a single invalid FCM token from the database (Patient + AppUser)
   */
  private async removeInvalidToken(fcmToken: string) {
    try {
      await Promise.all([
        Patient.update({ fcmToken: null }, { where: { fcmToken } }),
        AppUser.update({ fcmToken: null }, { where: { fcmToken } }),
      ]);
      console.log("🧹 Removed invalid FCM token from DB");
    } catch (error) {
      console.error("Error removing invalid token:", error);
    }
  }

  /**
   * Remove multiple invalid FCM tokens from the database (Patient + AppUser)
   */
  private async removeInvalidTokens(fcmTokens: string[]) {
    try {
      const { Op } = require("sequelize");
      await Promise.all([
        Patient.update({ fcmToken: null }, { where: { fcmToken: { [Op.in]: fcmTokens } } }),
        AppUser.update({ fcmToken: null }, { where: { fcmToken: { [Op.in]: fcmTokens } } }),
      ]);
      console.log(`🧹 Removed ${fcmTokens.length} invalid FCM tokens from DB`);
    } catch (error) {
      console.error("Error removing invalid tokens:", error);
    }
  }
}

export const fcmService = new FCMService();
