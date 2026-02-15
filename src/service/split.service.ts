// src/service/split.service.ts

import Decimal from "decimal.js";

// Configure Decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface SplitConfig {
    splitType: "PERCENTAGE" | "FIXED";
    vendorValue: number;
    doctorValue: number;
}

interface SplitResult {
    vendorAmount: string; // String to preserve precision
    doctorAmount: string;
    platformAmount: string;
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

/**
 * Validate a split configuration before saving
 */
export const validateSplitConfig = (
    config: SplitConfig,
    orderAmount?: number
): ValidationResult => {
    const errors: string[] = [];
    const vendorVal = new Decimal(config.vendorValue);
    const doctorVal = new Decimal(config.doctorValue);

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
            errors.push(
                `Percentage total (${total.toString()}%) exceeds 100%. ` +
                `Vendor: ${vendorVal}%, Doctor: ${doctorVal}%`
            );
        }
    }

    if (config.splitType === "FIXED" && orderAmount !== undefined) {
        const total = vendorVal.plus(doctorVal);
        const orderDec = new Decimal(orderAmount);
        if (total.greaterThan(orderDec)) {
            errors.push(
                `Fixed split total (₹${total.toFixed(2)}) exceeds order amount (₹${orderDec.toFixed(2)})`
            );
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

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
export const calculateSplit = (
    totalAmount: number,
    config: SplitConfig
): SplitResult => {
    const total = new Decimal(totalAmount);

    let vendorAmount: Decimal;
    let doctorAmount: Decimal;

    if (config.splitType === "PERCENTAGE") {
        // Calculate percentage-based split
        // Round to 2 decimal places using ROUND_HALF_UP (banker's rounding)
        vendorAmount = total
            .times(new Decimal(config.vendorValue))
            .dividedBy(100)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        doctorAmount = total
            .times(new Decimal(config.doctorValue))
            .dividedBy(100)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    } else {
        // Fixed amount split — values used directly
        vendorAmount = new Decimal(config.vendorValue).toDecimalPlaces(2);
        doctorAmount = new Decimal(config.doctorValue).toDecimalPlaces(2);
    }

    // Platform gets the remainder — this guarantees no money is lost or created
    const platformAmount = total
        .minus(vendorAmount)
        .minus(doctorAmount)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // Final safety check — platform amount must never be negative
    if (platformAmount.isNegative()) {
        throw new Error(
            `Split calculation error: platform amount is negative (₹${platformAmount.toFixed(2)}). ` +
            `Total: ₹${total.toFixed(2)}, Vendor: ₹${vendorAmount.toFixed(2)}, Doctor: ₹${doctorAmount.toFixed(2)}`
        );
    }

    return {
        vendorAmount: vendorAmount.toFixed(2),
        doctorAmount: doctorAmount.toFixed(2),
        platformAmount: platformAmount.toFixed(2),
    };
};
