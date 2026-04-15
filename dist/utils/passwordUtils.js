"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSecurePassword = void 0;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Generate a secure random password
 * @returns 12-character password with uppercase, lowercase, numbers, and symbols
 */
const generateSecurePassword = () => {
    const length = 12;
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*";
    const allChars = uppercase + lowercase + numbers + symbols;
    let password = "";
    // Ensure at least one character from each category
    password += uppercase[crypto_1.default.randomInt(0, uppercase.length)];
    password += lowercase[crypto_1.default.randomInt(0, lowercase.length)];
    password += numbers[crypto_1.default.randomInt(0, numbers.length)];
    password += symbols[crypto_1.default.randomInt(0, symbols.length)];
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
        password += allChars[crypto_1.default.randomInt(0, allChars.length)];
    }
    // Shuffle the password
    return password
        .split("")
        .sort(() => crypto_1.default.randomInt(-1, 2))
        .join("");
};
exports.generateSecurePassword = generateSecurePassword;
