"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
/**
 * Sends an email using the configured SMTP transport.
 * Accepts a complete `SendMailOptions` object from callers.
 * Throws 'EMAIL_SEND_FAILED' on failure.
 */
async function sendEmail(mailOptions) {
    try {
        const host = process.env.SMTP_HOST || 'smtp.gmail.com';
        const port = parseInt(process.env.SMTP_PORT || '587', 10);
        const transporter = nodemailer_1.default.createTransport({
            host,
            port,
            secure: port === 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
        });
        const finalOptions = {
            from: mailOptions.from || `"MDT Platform" <${process.env.SMTP_USER}>`,
            ...mailOptions,
        };
        await transporter.sendMail(finalOptions);
        console.log(`Email sent successfully to ${finalOptions.to}`);
    }
    catch (error) {
        console.error('Error sending email:', error);
        throw new Error('EMAIL_SEND_FAILED');
    }
}
exports.sendEmail = sendEmail;
