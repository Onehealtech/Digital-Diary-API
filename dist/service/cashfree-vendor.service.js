"use strict";
// src/service/cashfree-vendor.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCashfreeVendor = exports.createCashfreeVendor = void 0;
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const CASHFREE_BASE_URL = process.env.CASHFREE_ENV === "PRODUCTION"
    ? "https://api.cashfree.com/pg/"
    : "https://sandbox.cashfree.com/pg/";
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
/**
 * Generate a unique Cashfree vendor ID
 * Format: CF_DOC_a3f8b1c2 or CF_VND_a3f8b1c2
 */
const generateCashfreeVendorId = (role) => {
    const prefix = role === "DOCTOR" ? "CF_DOC" : "CF_VND";
    const random = crypto_1.default.randomBytes(4).toString("hex");
    const timestamp = Date.now().toString(36).slice(-4);
    return `${prefix}_${timestamp}${random}`.toUpperCase();
};
/**
 * Strip phone to 10 digits (remove +91, spaces, dashes)
 */
const sanitizePhone = (phone) => {
    if (!phone)
        return "9999999999";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) {
        return digits.slice(2);
    }
    if (digits.length === 10) {
        return digits;
    }
    return digits.slice(-10);
};
const createCashfreeVendor = async (params) => {
    const { vendorId, name, email, phone, role, bank, upi } = params;
    // Generate a unique Cashfree vendor ID (not your internal DB UUID)
    const cfVendorId = generateCashfreeVendorId(role);
    const payload = {
        vendor_id: cfVendorId,
        name,
        email,
        phone: sanitizePhone(phone),
        status: "ACTIVE",
        dashboard_access: false,
        schedule_option: 1,
    };
    if (bank) {
        if (!bank.accountNumber || !bank.ifsc || !bank.accountHolder) {
            throw new Error("Bank details require all 3 fields: accountNumber, ifsc, accountHolder");
        }
        payload.bank = {
            account_number: bank.accountNumber,
            ifsc: bank.ifsc,
            account_holder: bank.accountHolder,
        };
    }
    if (upi) {
        payload.upi = {
            vpa: upi.vpa,
            account_holder: name,
        };
    }
    payload.kyc_details = {
        account_type: "BUSINESS",
        business_type: "Grocery",
        uidai: "753624181019",
        gst: "11AAAAA1111A1Z0",
        cin: "L00000Aa0000AaA000000",
        pan: "BIAPA2934N",
        passport_number: "L6892603",
    };
    try {
        const response = await axios_1.default.post(`${CASHFREE_BASE_URL}easy-split/vendors`, payload, {
            headers: {
                "Content-Type": "application/json",
                "x-client-id": CASHFREE_APP_ID,
                "x-client-secret": CASHFREE_SECRET_KEY,
                "x-api-version": "2023-08-01",
            },
        });
        console.log("Cashfree vendor created:", response.data);
        return {
            vendor_id: response.data.vendor_id,
            status: response.data.status,
        };
    }
    catch (error) {
        const cfError = error.response?.data;
        console.error("Cashfree vendor creation failed:", cfError || error.message);
        throw new Error(cfError?.message ||
            `Failed to register vendor on Cashfree: ${error.message}`);
    }
};
exports.createCashfreeVendor = createCashfreeVendor;
const getCashfreeVendor = async (vendorId) => {
    try {
        const response = await axios_1.default.get(`${CASHFREE_BASE_URL}easy-split/vendors/${vendorId}`, {
            headers: {
                "x-client-id": CASHFREE_APP_ID,
                "x-client-secret": CASHFREE_SECRET_KEY,
                "x-api-version": "2023-08-01",
            },
        });
        return response.data;
    }
    catch (error) {
        const cfError = error.response?.data;
        throw new Error(cfError?.message || `Failed to fetch vendor: ${error.message}`);
    }
};
exports.getCashfreeVendor = getCashfreeVendor;
