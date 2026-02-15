// src/config/cashfree.ts

import { Cashfree, CFEnvironment } from "cashfree-pg";

/**
 * Create and export a configured Cashfree client instance
 * Uses sandbox or production based on CASHFREE_ENV
 */
const cashfreeEnvironment: CFEnvironment =
    process.env.CASHFREE_ENV === "PRODUCTION"
        ? CFEnvironment.PRODUCTION
        : CFEnvironment.SANDBOX;

export const cashfreeClient = new Cashfree(
    cashfreeEnvironment,
    process.env.CASHFREE_APP_ID!,
    process.env.CASHFREE_SECRET_KEY!
);

export const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2023-08-01";
