const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Initialize the email transporter.
 * Uses Ethereal for development (catches emails without sending).
 */
async function initializeMailer() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    try {
      // Create Ethereal test account for development
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log('📧 Using Ethereal test email account:', testAccount.user);
    } catch (err) {
      console.warn('⚠️ Could not connect to Ethereal Email (offline/no network). Falling back to mock mailer.');
      transporter = nodemailer.createTransport({
        jsonTransport: true
      });
    }
  }
}

/**
 * Send a password reset email.
 */
async function sendPasswordResetEmail(email, name, resetToken) {
  if (!transporter) {
    await initializeMailer();
  }

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5500'}/reset-password.html?token=${resetToken}`;

  const mailOptions = {
    from: '"Brightloop Software" <noreply@brightloop.com>',
    to: email,
    subject: 'Password Reset Request - Brightloop Software',
    html: `
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 28px; font-weight: 700;">Brightloop</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Subscription Management System</p>
        </div>
        <div style="background: #fff; padding: 40px 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 22px;">Password Reset Request</h2>
          <p style="color: #475569; line-height: 1.6; margin: 0 0 24px;">
            Hi <strong>${name}</strong>,<br><br>
            We received a request to reset your password. Click the button below to create a new password. This link will expire in <strong>30 minutes</strong>.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #fff; text-decoration: none; padding: 14px 40px; border-radius: 10px; font-weight: 600; font-size: 16px;">
              Reset Password
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">
            If you didn't request this, you can safely ignore this email. Your password won't be changed.<br><br>
            If the button doesn't work, copy and paste this URL into your browser:<br>
            <a href="${resetUrl}" style="color: #6366f1; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 24px;">
          &copy; 2024 Brightloop Software. All rights reserved.
        </p>
      </div>
    `
  };

  const info = await transporter.sendMail(mailOptions);

  // Log Ethereal preview URL in development
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('📧 Email preview URL:', previewUrl);
  } else {
    console.log('📧 Password reset URL:', resetUrl);
  }

  return { messageId: info.messageId, previewUrl };
}

module.exports = { initializeMailer, sendPasswordResetEmail };
