import { AppUser } from "../models/Appuser";
import { AppError } from "../utils/AppError";
import { HTTP_STATUS, UserRole } from "../utils/constants";
import { createCashfreeVendor } from "./cashfree-vendor.service";

type BankInput = {
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
};

type UpiInput = {
  vpa: string;
};

export type RegisterCashfreeVendorInput = {
  userId: string;
  bank?: BankInput;
  upi?: UpiInput;
};

export type RegisterCashfreeVendorResult = {
  status: "SUCCESS" | "ALREADY_REGISTERED";
  vendorId: string;
};

/**
 * Secondary operation: register Doctor/Vendor on Cashfree.
 * Throws on external API failure and keeps caller responsible for fallback handling.
 */
export const registerCashfreeVendor = async (
  input: RegisterCashfreeVendorInput
): Promise<RegisterCashfreeVendorResult> => {
  const user = await AppUser.findByPk(input.userId);
  if (!user) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, "User not found");
  }

  if (![UserRole.DOCTOR, UserRole.VENDOR].includes(user.role as UserRole)) {
    throw new AppError(
      HTTP_STATUS.BAD_REQUEST,
      "Only Doctors and Vendors can be onboarded to Cashfree"
    );
  }

  // Idempotency guard: do not create a duplicate Cashfree vendor.
  if (user.cashfreeVendorId) {
    return {
      status: "ALREADY_REGISTERED",
      vendorId: user.cashfreeVendorId,
    };
  }

  const cfResult = await createCashfreeVendor({
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
