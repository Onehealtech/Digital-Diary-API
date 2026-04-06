import { NextFunction, Request, Response } from "express";

type DoctorCreateRequestBody = {
  role?: string;
  fullName?: string;
  phone?: string;
  city?: string;
  state?: string;
  address?: string;
  license?: string;
  bank?: {
    accountHolder?: string;
    accountNumber?: string;
    ifsc?: string;
  };
};

const NAME_REGEX = /^[A-Za-z ]{1,100}$/;
const PHONE_REGEX = /^[0-9]{10}$/;
const CITY_STATE_REGEX = /^[A-Za-z ]{1,50}$/;
const ACCOUNT_HOLDER_REGEX = /^[A-Za-z ]{1,100}$/;
const ACCOUNT_NUMBER_REGEX = /^[0-9]{9,18}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const LICENSE_REGEX = /^[A-Za-z0-9]{1,30}$/;

const normalize = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

/**
 * Validates doctor creation payload with strict field-level regex checks.
 * Runs only when role === DOCTOR; other roles are passed through unchanged.
 */
export const validateCreateDoctorInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const body = (req.body || {}) as DoctorCreateRequestBody;

  if (body.role !== "DOCTOR") {
    next();
    return;
  }

  const errors: Record<string, string> = {};

  const fullName = normalize(body.fullName);
  const phone = normalize(body.phone);
  const city = normalize(body.city);
  const state = normalize(body.state);
  const address = normalize(body.address);
  const license = normalize(body.license);

  if (!NAME_REGEX.test(fullName)) {
    errors.fullName =
      "Full Name must contain only letters and spaces (max 100 characters)";
  }

  if (!PHONE_REGEX.test(phone)) {
    errors.phone = "Phone must be exactly 10 digits";
  }

  if (city && !CITY_STATE_REGEX.test(city)) {
    errors.city = "City must contain only letters and spaces (max 50 characters)";
  }

  if (state && !CITY_STATE_REGEX.test(state)) {
    errors.state =
      "State must contain only letters and spaces (max 50 characters)";
  }

  if (address.length > 250) {
    errors.address = "Address must be 250 characters or less";
  }

  if (license && !LICENSE_REGEX.test(license)) {
    errors.license =
      "License Number must be alphanumeric and at most 30 characters";
  }

  const bank = body.bank || {};
  const accountHolder = normalize(bank.accountHolder);
  const accountNumber = normalize(bank.accountNumber);
  const ifsc = normalize(bank.ifsc).toUpperCase();

  if (accountHolder && !ACCOUNT_HOLDER_REGEX.test(accountHolder)) {
    errors["bank.accountHolder"] =
      "Account Holder Name must contain only letters and spaces (max 100 characters)";
  }

  if (accountNumber && !ACCOUNT_NUMBER_REGEX.test(accountNumber)) {
    errors["bank.accountNumber"] =
      "Account Number must be numeric and 9 to 18 digits long";
  }

  if (ifsc && !IFSC_REGEX.test(ifsc)) {
    errors["bank.ifsc"] =
      "IFSC Code must be valid (example: SBIN0001234)";
  }

  // Persist sanitized values for downstream handlers.
  req.body.fullName = fullName;
  req.body.phone = phone;
  req.body.city = city || undefined;
  req.body.state = state || undefined;
  req.body.address = address || undefined;
  req.body.license = license || undefined;
  if (req.body.bank) {
    req.body.bank.accountHolder = accountHolder || undefined;
    req.body.bank.accountNumber = accountNumber || undefined;
    req.body.bank.ifsc = ifsc || undefined;
  }

  if (Object.keys(errors).length > 0) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
    return;
  }

  next();
};
