"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCashfreeVendor = void 0;
const Appuser_1 = require("../models/Appuser");
const AppError_1 = require("../utils/AppError");
const constants_1 = require("../utils/constants");
const cashfree_vendor_service_1 = require("./cashfree-vendor.service");
/**
 * Secondary operation: register Doctor/Vendor on Cashfree.
 * Throws on external API failure and keeps caller responsible for fallback handling.
 */
const registerCashfreeVendor = async (input) => {
    const user = await Appuser_1.AppUser.findByPk(input.userId);
    if (!user) {
        throw new AppError_1.AppError(constants_1.HTTP_STATUS.NOT_FOUND, "User not found");
    }
    if (![constants_1.UserRole.DOCTOR, constants_1.UserRole.VENDOR].includes(user.role)) {
        throw new AppError_1.AppError(constants_1.HTTP_STATUS.BAD_REQUEST, "Only Doctors and Vendors can be onboarded to Cashfree");
    }
    // Idempotency guard: do not create a duplicate Cashfree vendor.
    if (user.cashfreeVendorId) {
        return {
            status: "ALREADY_REGISTERED",
            vendorId: user.cashfreeVendorId,
        };
    }
    const cfResult = await (0, cashfree_vendor_service_1.createCashfreeVendor)({
        vendorId: user.id,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        bank: input.bank,
        upi: input.upi,
    });
    await user.update({ cashfreeVendorId: cfResult.vendor_id });
    return {
        status: "SUCCESS",
        vendorId: cfResult.vendor_id,
    };
};
exports.registerCashfreeVendor = registerCashfreeVendor;
