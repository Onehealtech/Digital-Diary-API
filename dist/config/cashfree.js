"use strict";
// src/config/cashfree.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.CASHFREE_API_VERSION = exports.cashfreeClient = void 0;
const cashfree_pg_1 = require("cashfree-pg");
/**
 * Create and export a configured Cashfree client instance
 * Uses sandbox or production based on CASHFREE_ENV
 */
const cashfreeEnvironment = process.env.CASHFREE_ENV === "PRODUCTION"
    ? cashfree_pg_1.CFEnvironment.PRODUCTION
    : cashfree_pg_1.CFEnvironment.SANDBOX;
exports.cashfreeClient = new cashfree_pg_1.Cashfree(cashfreeEnvironment, process.env.CASHFREE_APP_ID, process.env.CASHFREE_SECRET_KEY);
exports.CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2023-08-01";
