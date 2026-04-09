"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fcmService = void 0;
const admin = __importStar(require("firebase-admin"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const Patient_1 = require("../models/Patient");
const Appuser_1 = require("../models/Appuser");
const sequelize_1 = require("sequelize");
class FCMService {
    constructor() {
        this.initialized = false;
    }
    /**
     * Initialize Firebase Admin SDK.
     *
     * Priority order:
     *   1. FIREBASE_SERVICE_ACCOUNT_PATH — path to the service account JSON file (preferred)
     *   2. Individual env vars: FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
     */
    initialize() {
        if (this.initialized)
            return;
        try {
            let credential;
            // Option 1: load from service account JSON file
            const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
            if (serviceAccountPath) {
                const resolvedPath = path_1.default.resolve(serviceAccountPath);
                if (fs_1.default.existsSync(resolvedPath)) {
                    const serviceAccount = JSON.parse(fs_1.default.readFileSync(resolvedPath, "utf8"));
                    credential = admin.credential.cert(serviceAccount);
                    console.log(`✅ Firebase: loaded service account from ${resolvedPath}`);
                }
                else {
                    console.warn(`⚠️ FIREBASE_SERVICE_ACCOUNT_PATH set but file not found: ${resolvedPath}`);
                }
            }
            // Option 2: fall back to individual env vars
            if (!credential) {
                const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
                if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
                    credential = admin.credential.cert({
                        projectId: FIREBASE_PROJECT_ID,
                        clientEmail: FIREBASE_CLIENT_EMAIL,
                        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
                    });
                }
            }
            if (!credential) {
                console.warn("⚠️ Firebase credentials not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY. FCM disabled.");
                return;
            }
            admin.initializeApp({ credential });
            this.initialized = true;
            console.log("✅ Firebase Admin SDK initialized");
        }
        catch (error) {
            console.error("❌ Firebase initialization failed:", error);
        }
    }
    /**
     * Send push notification to a single device
     */
    async sendPushNotification(fcmToken, title, body, data) {
        if (!this.initialized) {
            console.warn("⚠️ FCM not initialized, skipping push notification");
            return false;
        }
        try {
            const message = {
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
        }
        catch (error) {
            console.error("❌ FCM push failed:", error.message);
            // If token is invalid/unregistered, remove it from DB
            if (error.code === "messaging/invalid-registration-token" ||
                error.code === "messaging/registration-token-not-registered") {
                await this.removeInvalidToken(fcmToken);
            }
            return false;
        }
    }
    /**
     * Send push notification to multiple devices
     */
    async sendMulticastPush(fcmTokens, title, body, data) {
        if (!this.initialized) {
            console.warn("⚠️ FCM not initialized, skipping multicast push");
            return { successCount: 0, failureCount: 0 };
        }
        if (fcmTokens.length === 0) {
            return { successCount: 0, failureCount: 0 };
        }
        try {
            const message = {
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
            console.log(`✅ FCM multicast: ${response.successCount} success, ${response.failureCount} failures`);
            // Remove invalid tokens
            const invalidTokens = [];
            response.responses.forEach((resp, idx) => {
                if (resp.error &&
                    (resp.error.code === "messaging/invalid-registration-token" ||
                        resp.error.code === "messaging/registration-token-not-registered")) {
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
        }
        catch (error) {
            console.error("❌ FCM multicast failed:", error.message);
            return { successCount: 0, failureCount: fcmTokens.length };
        }
    }
    /**
     * Remove a single invalid FCM token from the database (Patient + AppUser)
     */
    async removeInvalidToken(fcmToken) {
        try {
            await Promise.all([
                Patient_1.Patient.update({ fcmToken: null }, { where: { fcmToken } }),
                Appuser_1.AppUser.update({ fcmToken: null }, { where: { fcmToken } }),
            ]);
            console.log("🧹 Removed invalid FCM token from DB");
        }
        catch (error) {
            console.error("Error removing invalid token:", error);
        }
    }
    /**
     * Remove multiple invalid FCM tokens from the database (Patient + AppUser)
     */
    async removeInvalidTokens(fcmTokens) {
        try {
            await Promise.all([
                Patient_1.Patient.update({ fcmToken: null }, { where: { fcmToken: { [sequelize_1.Op.in]: fcmTokens } } }),
                Appuser_1.AppUser.update({ fcmToken: null }, { where: { fcmToken: { [sequelize_1.Op.in]: fcmTokens } } }),
            ]);
            console.log(`🧹 Removed ${fcmTokens.length} invalid FCM tokens from DB`);
        }
        catch (error) {
            console.error("Error removing invalid tokens:", error);
        }
    }
}
exports.fcmService = new FCMService();
