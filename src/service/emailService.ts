import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

/**
 * Send password email to newly created staff member
 * @param email - Recipient email address
 * @param password - Plain text password to send
 * @param role - User role (DOCTOR, VENDOR, ASSISTANT, SUPER_ADMIN)
 * @param fullName - User's full name
 */
export const sendPasswordEmail = async (
  email: string,
  password: string,
  role: string,
  fullName: string
): Promise<void> => {
  const roleDisplay = role.replace("_", " ").toLowerCase();

  const mailOptions = {
    from: `"OneHeal Support" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "OneHeal Login Credentials",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .credentials { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; }
          .password { font-size: 24px; font-weight: bold; color: #667eea; letter-spacing: 2px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 Welcome to OneHeal</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${fullName}</strong>,</p>
            
            <p>Your account has been created as a <strong>${roleDisplay}</strong> in the OneHeal Enterprise System.</p>
            
            <div class="credentials">
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Password:</strong></p>
              <p class="password">${password}</p>
            </div>
            
            <div class="warning">
              <strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.
            </div>
            
            <p>You can now log in to the OneHeal system using these credentials.</p>
            
            <p>If you have any questions or need assistance, please contact your administrator.</p>
            
            <p>Best regards,<br><strong>OneHeal Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; ${new Date().getFullYear()} OneHeal. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${email}:`, error);
    throw new Error("Failed to send email");
  }
};

/**
 * Send password reset email with a secure one-time link
 */
export const sendPasswordResetEmail = async (
  email: string,
  fullName: string,
  resetToken: string
): Promise<void> => {
  const appUrl = (process.env.FRONTEND_URL || process.env.BASE_URL || "").replace(/\/$/, "");
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

  const mailOptions = {
    from: `"OneHeal Support" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "OneHeal Password Reset Request",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0E2F5A 0%, #007787 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #007787; color: white; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .note { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .link-box { word-break: break-all; font-size: 13px; color: #555; background: white; padding: 12px; border-radius: 6px; border: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${fullName}</strong>,</p>
            <p>We received a request to reset your OneHeal account password.</p>

            <p>
              <a class="button" href="${resetUrl}">Reset Password</a>
            </p>

            <div class="link-box">
              If the button does not work, copy and paste this link into your browser:<br />
              ${resetUrl}
            </div>

            <div class="note">
              <strong>Important:</strong> This link will expire in 1 hour and can only be used once. If you did not request this reset, please ignore this email.
            </div>

            <p>Best regards,<br><strong>OneHeal Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; ${new Date().getFullYear()} OneHeal. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send password reset email to ${email}:`, error);
    throw new Error("Failed to send password reset email");
  }
};

/**
 * Send OTP email for 2FA
 * @param email - Recipient email address
 * @param otp - 6-digit OTP code
 * @param fullName - User's full name
 */
export const sendOTPEmail = async (
  email: string,
  otp: string,
  fullName: string
): Promise<void> => {
  const mailOptions = {
    from: `"OneHeal Support" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "OneHeal Login Verification Code",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; padding: 30px; text-align: center; margin: 20px 0; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .otp { font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
          .expiry { color: #dc3545; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Login Verification</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${fullName}</strong>,</p>
            
            <p>You requested to log in to your OneHeal account. Please use the following verification code:</p>
            
            <div class="otp-box">
              <p style="margin: 0; color: #666;">Your verification code is:</p>
              <p class="otp">${otp}</p>
              <p class="expiry">⏰ Expires in ${process.env.OTP_EXPIRY_MINUTES || 5} minutes</p>
            </div>
            
            <p>If you did not request this code, please ignore this email or contact support if you have concerns.</p>
            
            <p>Best regards,<br><strong>OneHeal Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; ${new Date().getFullYear()} OneHeal. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${email}`);
  } catch (error) {
    console.error(`❌ Failed to send OTP email to ${email}:`, error);
    throw new Error("Failed to send OTP email");
  }
};

/**
 * Send email when patient rejects an appointment
 */
export const sendAppointmentRejectionEmail = async (
  staffEmail: string,
  staffName: string,
  patientName: string,
  appointmentType: string,
  appointmentDate: string,
  rejectReason: string
): Promise<void> => {
  const mailOptions = {
    from: `"OneHeal Alerts" <${process.env.SMTP_USER}>`,
    to: staffEmail,
    subject: `Appointment Rejected - ${patientName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .details { background: white; padding: 20px; border-left: 4px solid #dc3545; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>⚠️ Appointment Rejected</h2>
          </div>
          <div class="content">
            <p>Hello Dr./Assistant <strong>${staffName}</strong>,</p>
            <p>Your patient <strong>${patientName}</strong> has rejected an upcoming appointment/reminder.</p>
            <div class="details">
              <p><strong>Type:</strong> ${appointmentType}</p>
              <p><strong>Original Date:</strong> ${appointmentDate}</p>
              <p><strong>Reason Provided:</strong> ${rejectReason}</p>
            </div>
            <p>Please log in to the OneHeal dashboard to review and manage this alert.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Rejection email sent to ${staffEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send rejection email to ${staffEmail}:`, error);
    throw new Error("Failed to send rejection email");
  }
};

/**
 * Send email to doctor when a self-signup patient sends an assignment request
 */
export const sendDoctorRequestEmail = async (
  doctorEmail: string,
  doctorName: string,
  patientName: string,
  patientAge: string,
  patientGender: string,
  caseType: string,
  patientPhone: string
): Promise<void> => {
  const mailOptions = {
    from: `"CanTRAC Alert" <${process.env.SMTP_USER}>`,
    to: doctorEmail,
    subject: `New Patient Request - ${patientName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0E2F5A 0%, #007787 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .details { background: white; padding: 20px; border-left: 4px solid #007787; margin: 20px 0; border-radius: 0 8px 8px 0; }
          .details p { margin: 8px 0; }
          .label { font-weight: bold; color: #0E2F5A; }
          .action { background: #007787; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; margin: 10px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .note { background: #E8F6F8; border-left: 4px solid #007787; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Patient Request</h1>
            <p>A patient has chosen you as their doctor</p>
          </div>
          <div class="content">
            <p>Hello Dr. <strong>${doctorName}</strong>,</p>

            <p>A new patient has signed up on CanTRAC and selected you as their preferred doctor. Please review the details below:</p>

            <div class="details">
              <p><span class="label">Patient Name:</span> ${patientName}</p>
              <p><span class="label">Age:</span> ${patientAge}</p>
              <p><span class="label">Gender:</span> ${patientGender}</p>
              <p><span class="label">Case Type:</span> ${caseType}</p>
              <p><span class="label">Phone:</span> ${patientPhone}</p>
            </div>

            <div class="note">
              <strong>Action Required:</strong> Please log in to your CanTRAC dashboard to accept or decline this request. The patient will be notified of your decision.
            </div>

            <p>If you have any questions, please contact support.</p>

            <p>Best regards,<br><strong>CanTRAC Team</strong></p>
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>&copy; ${new Date().getFullYear()} CanTRAC. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Doctor request email sent to ${doctorEmail}`);
  } catch (error) {
    console.error(`❌ Failed to send doctor request email to ${doctorEmail}:`, error);
    throw new Error("Failed to send doctor request email");
  }
};
