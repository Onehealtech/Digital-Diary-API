"use strict";
/**
 * SMS Fortius Service — sends SMS via smsfortius.org API
 *
 * Templates:
 *  1. Login OTP         (templateid: 1207177519219296859)
 *  2. Doctor Appointment (templateid: 1207177519385352008) — sent to patient
 *  3. Patient Consultation Alert (templateid: 1207177519626797564) — sent to doctor/staff
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendConsultationAlert = exports.sendDoctorAppointmentSMS = exports.sendLoginOTP = void 0;
const API_BASE = "https://smsfortius.org/V2/apikey.php";
const API_KEY = process.env.SMSFORTIUS_API_KEY || "w7GMJx4munLTTLYf";
const SENDER_ID = "ONEH";
/**
 * Normalize phone number to 91XXXXXXXXXX format (no + prefix).
 */
function formatPhone(phone) {
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length === 10)
        return `91${digits}`;
    if (digits.startsWith("91") && digits.length >= 12)
        return digits;
    return `91${digits.slice(-10)}`;
}
/**
 * Send SMS via Fortius API.
 */
async function sendSMS(phone, templateId, message) {
    const formattedPhone = formatPhone(phone);
    const url = `${API_BASE}?apikey=${encodeURIComponent(API_KEY)}&senderid=${SENDER_ID}&templateid=${templateId}&number=${formattedPhone}&message=${encodeURIComponent(message)}`;
    try {
        const response = await fetch(url);
        const text = await response.text();
        console.log(`[Fortius SMS] Sent to ${formattedPhone} | template=${templateId} | response=${text.trim()}`);
        return true;
    }
    catch (error) {
        console.error(`[Fortius SMS] Failed for ${formattedPhone}:`, error.message);
        return false;
    }
}
// ═══════════════════════════════════════════════════════════════════════════════
// Template 1: Login OTP
// Message: CANtrac: Your Login OTP is {otp}. Valid for {minutes}. Do not share this code with anyone.
// ═══════════════════════════════════════════════════════════════════════════════
async function sendLoginOTP(phone, otp, expiryMinutes = "5") {
    const message = `CANtrac: Your Login OTP is ${otp}. Valid for ${expiryMinutes} minutes. Do not share this code with anyone.`;
    return sendSMS(phone, "1207177519219296859", message);
}
exports.sendLoginOTP = sendLoginOTP;
// ═══════════════════════════════════════════════════════════════════════════════
// Template 2: Doctor Appointment SMS (sent to PATIENT)
// Message: Your appointment with Dr. {name} is confirmed for {date} at {time}. Please be available on time. Team CANtrac
// ═══════════════════════════════════════════════════════════════════════════════
async function sendDoctorAppointmentSMS(patientPhone, doctorName, date, time) {
    const message = `Your appointment with Dr. ${doctorName} is confirmed for ${date} at ${time}. Please be available on time. Team CANtrac`;
    return sendSMS(patientPhone, "1207177519385352008", message);
}
exports.sendDoctorAppointmentSMS = sendDoctorAppointmentSMS;
// ═══════════════════════════════════════════════════════════════════════════════
// Template 3: Patient Consultation Alert (sent to DOCTOR/STAFF)
// Message: New appointment confirmed by {patientName} for {date} at {time}. Please check and prepare accordingly. Team CANtrac
// ═══════════════════════════════════════════════════════════════════════════════
async function sendConsultationAlert(staffPhone, patientName, date, time) {
    const message = `New appointment confirmed by ${patientName} for ${date} at ${time}. Please check and prepare accordingly. Team CANtrac`;
    return sendSMS(staffPhone, "1207177519626797564", message);
}
exports.sendConsultationAlert = sendConsultationAlert;
