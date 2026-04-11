/**
 * SMS Fortius Service — sends SMS via smsfortius.org API
 *
 * Templates:
 *  1. Login OTP         (templateid: 1207177519219296859)
 *  2. Doctor Appointment (templateid: 1207177519385352008) — sent to patient
 *  3. Patient Consultation Alert (templateid: 1207177519626797564) — sent to doctor/staff
 */

const API_BASE = "https://smsfortius.org/V2/apikey.php";
const API_KEY = process.env.SMSFORTIUS_API_KEY || "w7GMJx4munLTTLYf";
const SENDER_ID = "ONEH";
const dotenv = require('dotenv');
dotenv.config();
/**
 * Normalize phone number to 91XXXXXXXXXX format (no + prefix).
 */
function formatPhone(phone: string): string {
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length === 10) return `91${digits}`;
    if (digits.startsWith("91") && digits.length >= 12) return digits;
    return `91${digits.slice(-10)}`;
}

/**
 * Send SMS via Fortius API.
 */
async function sendTemplateSMS(
    phone: string,
    templateId: string,
    message: string
): Promise<boolean> {
    const formattedPhone = formatPhone(phone);
    const url = `${API_BASE}?apikey=${encodeURIComponent(API_KEY)}&senderid=${SENDER_ID}&templateid=${templateId}&number=${formattedPhone}&message=${encodeURIComponent(message)}`;

    try {
        const response = await fetch(url);
        const text = await response.text();
        console.log(`[Fortius SMS] Sent to ${formattedPhone} | template=${templateId} | response=${text.trim()}`);
        return true;
    } catch (error: any) {
        console.error(`[Fortius SMS] Failed for ${formattedPhone}:`, error.message);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Template 1: Login OTP
// Message: CANtrac: Your Login OTP is {otp}. Valid for {minutes}. Do not share this code with anyone.
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendLoginOTP(phone: string, otp: string, expiryMinutes: string = "5"): Promise<boolean> {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[Fortius SMS] Staging mode — skipping OTP SMS to ${formatPhone(phone)} (OTP: ${otp})`);
        return true;
    }
    const message = `CANtrac: Your Login OTP is ${otp}. Valid for ${expiryMinutes} minutes. Do not share this code with anyone. ONEHEAL TECHNOLOGIES`;
    return sendTemplateSMS(phone, "1207177519219296859", message);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Template 2: Doctor Appointment SMS (sent to PATIENT)
// Message: Your appointment with Dr. {name} is confirmed for {date} at {time}. Please be available on time. Team CANtrac
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendDoctorAppointmentSMS(
    patientPhone: string,
    doctorName: string,
    date: string,
    time: string
): Promise<boolean> {
    const message = `Your appointment with Dr. ${doctorName} is confirmed for ${date} at ${time}. Please be available on time. Team CANtrac. ONEHEAL TECHNOLOGIES`;
    return sendTemplateSMS(patientPhone, "1207177519385352008", message);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Template 3: Patient Consultation Alert (sent to DOCTOR/STAFF)
// Message: New appointment confirmed by {patientName} for {date} at {time}. Please check and prepare accordingly. Team CANtrac
// ═══════════════════════════════════════════════════════════════════════════════

export async function sendConsultationAlert(
    staffPhone: string,
    patientName: string,
    date: string,
    time: string
): Promise<boolean> {
    const message = `New appointment confirmed by ${patientName} for ${date} at ${time}. Please check and prepare accordingly. Team CANtrac ONEHEAL TECHNOLOGIES`;
    return sendTemplateSMS(staffPhone, "1207177519626797564", message);
}

// ═══════════════════════════════════════════════════════════════════════════════
// General-purpose wrappers (replace Twilio usage)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send OTP via SMS — uses the Login OTP template.
 * In staging/non-production, skips actual SMS sending (OTP is always 123456).
 */
export async function sendOTP(phone: string, otp: string): Promise<boolean> {
    console.log(`[Fortius SMS] Preparing to send OTP ${process.env.NODE_ENV}`);
    
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[Fortius SMS] Staging mode — skipping SMS to ${formatPhone(phone)} (OTP: ${otp})`);
        return true;
    }
    const expiryMinutes = process.env.OTP_EXPIRY_MINUTES || "5";
    return sendLoginOTP(phone, otp, expiryMinutes);
}

/**
 * Send a general SMS message.
 * Uses the consultation alert template format.
 * Drop-in replacement for twilioService.sendSMS(phone, message).
 */
export async function sendSMS(phone: string, message: string): Promise<boolean> {
    return sendTemplateSMS(phone, "1207177519626797564", message);
}
