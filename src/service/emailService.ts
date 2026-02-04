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
 * @param role - User role (DOCTOR, PHARMACIST, ASSISTANT)
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
