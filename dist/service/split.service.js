"use strict";
// src/service/split.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSplit = exports.validateSplitConfig = void 0;
const decimal_js_1 = __importDefault(require("decimal.js"));
// Configure Decimal.js for financial precision
decimal_js_1.default.set({ precision: 20, rounding: decimal_js_1.default.ROUND_HALF_UP });
/**
 * Validate a split configuration before saving
 */
const validateSplitConfig = (config, orderAmount) => {
    const errors = [];
    const vendorVal = new decimal_js_1.default(config.vendorValue);
    const doctorVal = new decimal_js_1.default(config.doctorValue);
    // Values must be non-negative
    if (vendorVal.isNegative()) {
        errors.push("Vendor value cannot be negative");
    }
    if (doctorVal.isNegative()) {
        errors.push("Doctor value cannot be negative");
    }
    if (config.splitType === "PERCENTAGE") {
        const total = vendorVal.plus(doctorVal);
        if (total.greaterThan(100)) {
            errors.push(`Percentage total (${total.toString()}%) exceeds 100%. ` +
                `Vendor: ${vendorVal}%, Doctor: ${doctorVal}%`);
        }
    }
    if (config.splitType === "FIXED" && orderAmount !== undefined) {
        const total = vendorVal.plus(doctorVal);
        const orderDec = new decimal_js_1.default(orderAmount);
        if (total.greaterThan(orderDec)) {
            errors.push(`Fixed split total (₹${total.toFixed(2)}) exceeds order amount (₹${orderDec.toFixed(2)})`);
        }
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
};
exports.validateSplitConfig = validateSplitConfig;
/**
 * Calculate split amounts for an order
 *
 * Uses Decimal.js to prevent floating-point precision errors.
 * Platform gets the remainder (total - vendor - doctor).
 *
 * @param totalAmount - Total order amount
 * @param config - Active split configuration
 * @returns Calculated split amounts as strings (for DECIMAL DB columns)
 */
const calculateSplit = (totalAmount, config) => {
    const total = new decimal_js_1.default(totalAmount);
    let vendorAmount;
    let doctorAmount;
    if (config.splitType === "PERCENTAGE") {
        // Calculate percentage-based split
        // Round to 2 decimal places using ROUND_HALF_UP (banker's rounding)
        vendorAmount = total
            .times(new decimal_js_1.default(config.vendorValue))
            .dividedBy(100)
            .toDecimalPlaces(2, decimal_js_1.default.ROUND_HALF_UP);
        doctorAmount = total
            .times(new decimal_js_1.default(config.doctorValue))
            .dividedBy(100)
            .toDecimalPlaces(2, decimal_js_1.default.ROUND_HALF_UP);
    }
    else {
        // Fixed amount split — values used directly
        vendorAmount = new decimal_js_1.default(config.vendorValue).toDecimalPlaces(2);
        doctorAmount = new decimal_js_1.default(config.doctorValue).toDecimalPlaces(2);
    }
    // Platform gets the remainder — this guarantees no money is lost or created
    const platformAmount = total
        .minus(vendorAmount)
        .minus(doctorAmount)
        .toDecimalPlaces(2, decimal_js_1.default.ROUND_HALF_UP);
    // Final safety check — platform amount must never be negative
    if (platformAmount.isNegative()) {
        throw new Error(`Split calculation error: platform amount is negative (₹${platformAmount.toFixed(2)}). ` +
            `Total: ₹${total.toFixed(2)}, Vendor: ₹${vendorAmount.toFixed(2)}, Doctor: ₹${doctorAmount.toFixed(2)}`);
    }
    return {
        vendorAmount: vendorAmount.toFixed(2),
        doctorAmount: doctorAmount.toFixed(2),
        platformAmount: platformAmount.toFixed(2),
    };
};
exports.calculateSplit = calculateSplit;
