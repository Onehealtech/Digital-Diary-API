// src/service/cashfree-vendor.service.ts

import crypto from "crypto";
import axios from "axios";

const CASHFREE_BASE_URL = process.env.CASHFREE_ENV === "PRODUCTION"
    ? "https://api.cashfree.com/pg/"
    : "https://sandbox.cashfree.com/pg/";

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID!;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY!;

interface CreateCashfreeVendorParams {
    vendorId: string;       // Internal DB user ID — used to generate CF vendor ID
    name: string;
    email: string;
    phone?: string;
    role: string;           // DOCTOR or VENDOR — used as prefix
    bank?: {
        accountNumber: any;
        ifsc: any;
        accountHolder: any;
    };
    upi?: {
        vpa: string;
    };
}

interface CashfreeVendorResponse {
    vendor_id: string;
    status: string;
}

/**
 * Generate a unique Cashfree vendor ID
 * Format: CF_DOC_a3f8b1c2 or CF_VND_a3f8b1c2
 */
const generateCashfreeVendorId = (role: string): string => {
    const prefix = role === "DOCTOR" ? "CF_DOC" : "CF_VND";
    const random = crypto.randomBytes(4).toString("hex");
    const timestamp = Date.now().toString(36).slice(-4);
    return `${prefix}_${timestamp}${random}`.toUpperCase();
};

/**
 * Strip phone to 10 digits (remove +91, spaces, dashes)
 */
const sanitizePhone = (phone?: string): string => {
    if (!phone) return "9999999999";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) {
        return digits.slice(2);
    }
    if (digits.length === 10) {
        return digits;
    }
    return digits.slice(-10);
};

export const createCashfreeVendor = async (
    params: CreateCashfreeVendorParams
): Promise<CashfreeVendorResponse> => {
    const { vendorId, name, email, phone, role, bank, upi } = params;

    // Generate a unique Cashfree vendor ID (not your internal DB UUID)
    const cfVendorId = generateCashfreeVendorId(role);

    const payload: Record<string, any> = {
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
            throw new Error(
                "Bank details require all 3 fields: accountNumber, ifsc, accountHolder"
            );
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
        const response = await axios.post(
            `${CASHFREE_BASE_URL}easy-split/vendors`,
            payload,
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-client-id": CASHFREE_APP_ID,
                    "x-client-secret": CASHFREE_SECRET_KEY,
                    "x-api-version": "2023-08-01",
                },
            }
        );

        console.log("Cashfree vendor created:", response.data);

        return {
            vendor_id: response.data.vendor_id,
            status: response.data.status,
        };
    } catch (error: any) {
        const cfError = error.response?.data;
        console.error("Cashfree vendor creation failed:", cfError || error.message);

        throw new Error(
            cfError?.message ||
            `Failed to register vendor on Cashfree: ${error.message}`
        );
    }
};

export const getCashfreeVendor = async (vendorId: string) => {
    try {
        const response = await axios.get(
            `${CASHFREE_BASE_URL}easy-split/vendors/${vendorId}`,
            {
                headers: {
                    "x-client-id": CASHFREE_APP_ID,
                    "x-client-secret": CASHFREE_SECRET_KEY,
                    "x-api-version": "2023-08-01",
                },
            }
        );
        return response.data;
    } catch (error: any) {
        const cfError = error.response?.data;
        throw new Error(cfError?.message || `Failed to fetch vendor: ${error.message}`);
    }
};