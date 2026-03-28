"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReferralCode = void 0;
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/1/I to avoid confusion
function generateReferralCode(length = 8) {
    let code = "";
    for (let i = 0; i < length; i++) {
        code += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    return code;
}
exports.generateReferralCode = generateReferralCode;
