import nodemailer from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';

/**
 * Sends an email using the configured SMTP transport.
 * Accepts a complete `SendMailOptions` object from callers.
 * Throws 'EMAIL_SEND_FAILED' on failure.
 */
export async function sendEmail(mailOptions: SendMailOptions): Promise<void> {
  try {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    const finalOptions: SendMailOptions = {
      from: mailOptions.from || `"MDT Platform" <${process.env.SMTP_USER}>`,
      ...mailOptions,
    };

    await transporter.sendMail(finalOptions);
    console.log(`Email sent successfully to ${finalOptions.to}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('EMAIL_SEND_FAILED');
  }
}
